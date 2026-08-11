import { createTheme, FieldType, toDataFrame, type FieldColor } from '@grafana/data';
import { FieldColorModeId, TableCellDisplayMode, TableSparklineColorMode } from '@grafana/schema';

import { getSparklineColor } from './sparklineColor';

describe('getSparklineColor', () => {
  const theme = createTheme();
  const fieldColor: FieldColor = { mode: FieldColorModeId.Fixed, fixedColor: 'blue' };

  const frame = toDataFrame({
    fields: [
      { name: 'service', type: FieldType.string, values: ['api', 'db', 'api', null] },
      {
        name: 'trend',
        type: FieldType.number,
        values: [1, 2, 3, 4],
        config: {
          color: fieldColor,
        },
      },
    ],
  });

  const sparklineField = frame.fields[1];

  it('uses the field color in the default color mode', () => {
    expect(
      getSparklineColor(
        sparklineField,
        0,
        frame,
        { type: TableCellDisplayMode.Sparkline, sparklineColorMode: TableSparklineColorMode.Field },
        theme
      )
    ).toBe(fieldColor);
  });

  it('uses the same palette color for rows with the same source field value', () => {
    const first = getSparklineColor(
      sparklineField,
      0,
      frame,
      {
        type: TableCellDisplayMode.Sparkline,
        sparklineColorMode: TableSparklineColorMode.ByFieldValue,
        sparklineColorField: 'service',
      },
      theme
    );
    const third = getSparklineColor(
      sparklineField,
      2,
      frame,
      {
        type: TableCellDisplayMode.Sparkline,
        sparklineColorMode: TableSparklineColorMode.ByFieldValue,
        sparklineColorField: 'service',
      },
      theme
    );

    expect(first).toEqual(third);
  });

  it('usually uses different palette colors for different source field values', () => {
    const first = getSparklineColor(
      sparklineField,
      0,
      frame,
      {
        type: TableCellDisplayMode.Sparkline,
        sparklineColorMode: TableSparklineColorMode.ByFieldValue,
        sparklineColorField: 'service',
      },
      theme
    );
    const second = getSparklineColor(
      sparklineField,
      1,
      frame,
      {
        type: TableCellDisplayMode.Sparkline,
        sparklineColorMode: TableSparklineColorMode.ByFieldValue,
        sparklineColorField: 'service',
      },
      theme
    );

    expect(first).not.toEqual(second);
  });

  it('falls back to the field color when the source field is missing', () => {
    expect(
      getSparklineColor(
        sparklineField,
        0,
        frame,
        {
          type: TableCellDisplayMode.Sparkline,
          sparklineColorMode: TableSparklineColorMode.ByFieldValue,
          sparklineColorField: 'missing',
        },
        theme
      )
    ).toBe(fieldColor);
  });

  it('falls back to the field color when the source field value is null or undefined', () => {
    expect(
      getSparklineColor(
        sparklineField,
        3,
        frame,
        {
          type: TableCellDisplayMode.Sparkline,
          sparklineColorMode: TableSparklineColorMode.ByFieldValue,
          sparklineColorField: 'service',
        },
        theme
      )
    ).toBe(fieldColor);
    expect(
      getSparklineColor(
        sparklineField,
        99,
        frame,
        {
          type: TableCellDisplayMode.Sparkline,
          sparklineColorMode: TableSparklineColorMode.ByFieldValue,
          sparklineColorField: 'service',
        },
        theme
      )
    ).toBe(fieldColor);
  });
});
