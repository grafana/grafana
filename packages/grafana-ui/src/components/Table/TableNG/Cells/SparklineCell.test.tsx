import { render } from '@testing-library/react';

import {
  applyFieldOverrides,
  createTheme,
  FieldColorModeId,
  FieldType,
  type Field,
  ThresholdsMode,
  toDataFrame,
} from '@grafana/data';
import { GraphGradientMode, TableCellDisplayMode } from '@grafana/schema';

import { SparklineCell } from './SparklineCell';

const sparklineSpy = jest.fn((_props: unknown) => <div data-testid="sparkline-mock" />);

jest.mock('../../../Sparkline/Sparkline', () => ({
  Sparkline: (props: unknown) => sparklineSpy(props),
}));

const tsFrame = toDataFrame({
  fields: [
    { name: 'time', type: FieldType.time, values: [1000, 2000] },
    { name: 'v', type: FieldType.number, values: [1, 99] },
  ],
});

function sparklineField(config: Field['config']): Field {
  const raw = toDataFrame({
    fields: [
      {
        name: 'trend',
        type: FieldType.frame,
        values: [tsFrame],
        config,
      },
    ],
  });
  return applyFieldOverrides({
    data: [raw],
    fieldConfig: { defaults: {}, overrides: [] },
    replaceVariables: (v) => v,
    theme: createTheme(),
    timeZone: 'utc',
  })[0].fields[0];
}

function renderSparklineCell(field: Field) {
  return render(
    <SparklineCell field={field} rowIdx={0} theme={createTheme()} value={tsFrame} width={300} />
  );
}

describe('TableNG SparklineCell threshold wiring', () => {
  beforeEach(() => {
    sparklineSpy.mockClear();
  });

  it('passes thresholds and scheme gradient for From thresholds color mode', () => {
    const field = sparklineField({
      custom: { cellOptions: { type: TableCellDisplayMode.Sparkline } },
      color: { mode: FieldColorModeId.Thresholds },
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 80, color: 'red' },
        ],
      },
    });

    renderSparklineCell(field);

    expect(sparklineSpy).toHaveBeenCalled();
    const cfg = (sparklineSpy.mock.calls[0][0] as { config: unknown }).config as Record<string, unknown>;
    expect(cfg.thresholds).toEqual(field.config.thresholds);
    expect((cfg.custom as { gradientMode: string }).gradientMode).toBe(GraphGradientMode.Scheme);
  });

  it('does not pass thresholds onto Sparkline when color is fixed so Hue stays decorative', () => {
    const field = sparklineField({
      custom: { cellOptions: { type: TableCellDisplayMode.Sparkline } },
      color: { mode: FieldColorModeId.Fixed, fixedColor: 'blue' },
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [{ value: 0, color: 'green' }],
      },
    });

    renderSparklineCell(field);

    const cfg = (sparklineSpy.mock.calls[0][0] as { config: unknown }).config as Record<string, unknown>;
    expect(cfg.thresholds).toBeUndefined();
    expect((cfg.custom as { gradientMode: string }).gradientMode).toBe(GraphGradientMode.Hue);
  });

  it('does not use scheme when threshold mode has no steps', () => {
    const field = sparklineField({
      custom: { cellOptions: { type: TableCellDisplayMode.Sparkline } },
      color: { mode: FieldColorModeId.Thresholds },
      thresholds: { mode: ThresholdsMode.Absolute, steps: [] },
    });

    renderSparklineCell(field);

    const cfg = (sparklineSpy.mock.calls[0][0] as { config: unknown }).config as Record<string, unknown>;
    expect(cfg.thresholds).toBeUndefined();
    expect((cfg.custom as { gradientMode: string }).gradientMode).toBe(GraphGradientMode.Hue);
  });
});
