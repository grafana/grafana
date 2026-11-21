import {
  createTheme,
  type DataFrame,
  type FieldConfig,
  FieldColorModeId,
  FieldType,
  ThresholdsMode,
  toDataFrame,
} from '@grafana/data';
import { type ColorDimensionConfig } from '@grafana/schema';

import { getColorDimension } from './color';

const theme = createTheme();

function frameWithField(config: FieldConfig): DataFrame {
  return toDataFrame({
    fields: [{ name: 'v', type: FieldType.number, values: [0, 20], config }],
  });
}

describe('color dimension', () => {
  describe('no field configured', () => {
    it('resolves the fixed color by name and is not assumed', () => {
      const dim = getColorDimension(undefined, { fixed: 'red', field: '' } as ColorDimensionConfig, theme);
      expect(dim.value()).toBe(theme.visualization.getColorByName('red'));
      expect(dim.isAssumed).toBe(false);
    });

    it('defaults to grey and is assumed when no fixed color is set', () => {
      const dim = getColorDimension(undefined, { field: '' } as ColorDimensionConfig, theme);
      expect(dim.value()).toBe(theme.visualization.getColorByName('grey'));
      expect(dim.isAssumed).toBe(true);
    });

    it('is assumed when a field name is set but the field is missing', () => {
      const dim = getColorDimension(frameWithField({}), { fixed: 'red', field: 'missing' }, theme);
      expect(dim.isAssumed).toBe(true);
      expect(dim.field).toBeUndefined();
    });
  });

  describe('field configured', () => {
    it('returns a value-independent color for a fixed-color field', () => {
      const dim = getColorDimension(
        frameWithField({ color: { mode: FieldColorModeId.Fixed, fixedColor: 'blue' } }),
        { fixed: '', field: 'v' },
        theme
      );
      expect(dim.field?.name).toBe('v');
      expect(dim.get(0)).toBe(theme.visualization.getColorByName('blue'));
      // fixed color does not vary by index
      expect(dim.get(1)).toBe(dim.get(0));
    });

    it('maps each value through thresholds for a by-value field', () => {
      const dim = getColorDimension(
        frameWithField({
          color: { mode: FieldColorModeId.Thresholds },
          thresholds: {
            mode: ThresholdsMode.Absolute,
            steps: [
              { value: -Infinity, color: 'green' },
              { value: 10, color: 'red' },
            ],
          },
        }),
        { fixed: '', field: 'v' },
        theme
      );
      // value 0 is below the 10 threshold -> green, value 20 is above -> red
      expect(dim.get(0)).toBe(theme.visualization.getColorByName('green'));
      expect(dim.get(1)).toBe(theme.visualization.getColorByName('red'));
    });

    it('scales a time field over its own min and max', () => {
      const start = 1700000000000;
      const frame = toDataFrame({
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: [start, start + 30000, start + 60000],
            config: { color: { mode: FieldColorModeId.ContinuousGrYlRd } },
          },
        ],
      });
      const dim = getColorDimension(frame, { fixed: '', field: 'time' }, theme);

      // oldest is the start of the green-yellow-red gradient, newest is the end
      expect([dim.get(0), dim.get(1), dim.get(2)]).toEqual([
        'rgb(115, 191, 105)',
        'rgb(226, 192, 61)',
        'rgb(242, 73, 92)',
      ]);
      expect(dim.field?.state?.range).toEqual({ min: start, max: start + 60000, delta: 60000 });
    });

    it('keeps a configured min and max for a time field', () => {
      const start = 1700000000000;
      const frame = toDataFrame({
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: [start, start + 60000],
            config: { color: { mode: FieldColorModeId.ContinuousGrYlRd }, min: start - 60000 },
          },
        ],
      });
      const dim = getColorDimension(frame, { fixed: '', field: 'time' }, theme);

      // with the min a minute earlier, the oldest value sits in the middle of the gradient
      expect([dim.get(0), dim.get(1)]).toEqual(['rgb(226, 192, 61)', 'rgb(242, 73, 92)']);
    });
  });
});
