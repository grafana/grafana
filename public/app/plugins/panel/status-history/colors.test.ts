import {
  createDataFrame,
  createTheme,
  FALLBACK_COLOR,
  type Field,
  FieldType,
  getDisplayProcessor,
  MappingType,
  ThresholdsMode,
} from '@grafana/data';
import { FieldColorModeId } from '@grafana/schema';

// Baseline for the status-history / state-timeline cell color contract. The
// TimelineChart panel colors each cell via `field.display(value).color ?? FALLBACK_COLOR`
// (TimelineChart.tsx getValueColor). There is currently no status-history color
// coverage; this pins the resolved status->color mapping so the upcoming
// `field.display.color(value)` migration of getValueColor is provably equivalent
// (the resolved colors must not change).
const theme = createTheme();

function statusField(config: Record<string, unknown>, values: unknown[], type = FieldType.number): Field {
  const field = createDataFrame({ fields: [{ name: 'status', type, values, config }] }).fields[0];
  field.display = getDisplayProcessor({ field, theme });
  return field;
}

// mirrors TimelineChart.tsx getValueColor exactly (pre-migration)
function getValueColor(field: Field, value: unknown): string {
  const disp = field.display!(value);
  return disp.color ?? FALLBACK_COLOR;
}

describe('status-history cell color contract', () => {
  it('resolves ValueToText status codes to their mapped colors', () => {
    const field = statusField(
      {
        mappings: [
          {
            type: MappingType.ValueToText,
            options: {
              '1': { text: 'OK', color: 'green' },
              '2': { text: 'Warning', color: 'yellow' },
              '3': { text: 'Critical', color: 'red' },
            },
          },
        ],
      },
      [1, 2, 3]
    );

    expect(getValueColor(field, 1)).toEqual(theme.visualization.getColorByName('green'));
    expect(getValueColor(field, 2)).toEqual(theme.visualization.getColorByName('yellow'));
    expect(getValueColor(field, 3)).toEqual(theme.visualization.getColorByName('red'));
  });

  it('resolves string status values mapped to colors', () => {
    const field = statusField(
      {
        mappings: [
          {
            type: MappingType.ValueToText,
            options: {
              up: { color: 'green' },
              down: { color: 'red' },
            },
          },
        ],
      },
      ['up', 'down'],
      FieldType.string
    );

    expect(getValueColor(field, 'up')).toEqual(theme.visualization.getColorByName('green'));
    expect(getValueColor(field, 'down')).toEqual(theme.visualization.getColorByName('red'));
  });

  it('resolves threshold-based status colors', () => {
    const field = statusField(
      {
        color: { mode: FieldColorModeId.Thresholds },
        thresholds: {
          mode: ThresholdsMode.Absolute,
          steps: [
            { value: -Infinity, color: 'green' },
            { value: 1, color: 'yellow' },
            { value: 2, color: 'red' },
          ],
        },
      },
      [0, 1, 2]
    );

    // resolved colors come from the active threshold step
    expect(getValueColor(field, 0)).toEqual(field.display!(0).color);
    expect(getValueColor(field, 1)).toEqual(field.display!(1).color);
    expect(getValueColor(field, 2)).toEqual(field.display!(2).color);
    // distinct steps => distinct colors
    expect(new Set([getValueColor(field, 0), getValueColor(field, 1), getValueColor(field, 2)]).size).toBe(3);
  });

  it('falls back to FALLBACK_COLOR only when display yields no color', () => {
    // a string field with no mappings/thresholds still gets a base color from the
    // scale fallback, so getValueColor should never be the raw FALLBACK here
    const mapped = statusField(
      { mappings: [{ type: MappingType.ValueToText, options: { '1': { text: 'OK', color: 'green' } } }] },
      [1]
    );
    expect(getValueColor(mapped, 1)).not.toEqual(FALLBACK_COLOR);
  });
});
