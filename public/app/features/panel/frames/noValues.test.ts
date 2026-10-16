import {
  createDataFrame,
  createTheme,
  dateTime,
  type FieldConfig,
  type FieldConfigSource,
  FieldMatcherID,
  FieldType,
  LoadingState,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
  ThresholdsMode,
  type TimeRange,
} from '@grafana/data';
import { type GraphFieldConfig, GraphThresholdsStyleMode } from '@grafana/schema';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';

import { buildNoValuesPlaceholderFrame, getNoValuesShape, isNoValuesPlaceholderFrame } from './noValues';

describe('getNoValuesShape', () => {
  const lineThresholds: FieldConfig<GraphFieldConfig> = {
    custom: { thresholdsStyle: { mode: GraphThresholdsStyleMode.Line } },
    thresholds: {
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: 'green' },
        { value: 80, color: 'red' },
      ],
    },
  };

  const frameWith = (values: unknown[], config: FieldConfig<GraphFieldConfig> = lineThresholds) =>
    createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: values.map((_, i) => 1000 * (i + 1)) },
        { name: 'value', type: FieldType.number, values, config },
      ],
    });

  const shapeOf = (overrides: Partial<Parameters<typeof getNoValuesShape>[0]> = {}) =>
    getNoValuesShape({
      series: [],
      frames: [],
      state: LoadingState.Done,
      hasResponse: true,
      defaults: lineThresholds,
      ...overrides,
    });

  describe('no frames', () => {
    it('returns no-frames for an empty response with drawable thresholds', () => {
      expect(shapeOf()).toBe('no-frames');
    });

    it('returns no-frames when every raw frame has zero rows', () => {
      expect(shapeOf({ series: [createDataFrame({ fields: [] })] })).toBe('no-frames');
    });

    it('returns none when raw frames have rows that are not graphable', () => {
      const stringsOnly = createDataFrame({ fields: [{ name: 'a', type: FieldType.string, values: ['x'] }] });

      expect(shapeOf({ series: [stringsOnly] })).toBe('none');
    });

    it('returns none when there is a data warning', () => {
      expect(shapeOf({ warning: 'Long data must be converted to wide' })).toBe('none');
    });
  });

  describe('no values', () => {
    it.each([
      { name: 'zero rows', values: [] },
      { name: 'only nulls', values: [null, null, null] },
    ])('returns no-values for a frame with $name', ({ values }) => {
      const frame = frameWith(values);

      expect(shapeOf({ series: [frame], frames: [frame] })).toBe('no-values');
    });

    it('returns none when any field has a value', () => {
      const empty = frameWith([null, null]);
      const withValue = frameWith([null, 5]);

      expect(shapeOf({ series: [empty, withValue], frames: [empty, withValue] })).toBe('none');
    });

    it('reads thresholds from the fields, not the panel defaults', () => {
      const frame = frameWith([null], { custom: { thresholdsStyle: { mode: GraphThresholdsStyleMode.Off } } });

      expect(shapeOf({ series: [frame], frames: [frame] })).toBe('none');
    });
  });

  describe('loading state', () => {
    it('returns none on error', () => {
      expect(shapeOf({ state: LoadingState.Error })).toBe('none');
    });

    it('returns none while the first response is loading', () => {
      expect(shapeOf({ state: LoadingState.Loading, hasResponse: false })).toBe('none');
    });

    it('keeps the shape while a refresh is loading', () => {
      expect(shapeOf({ state: LoadingState.Loading, hasResponse: true })).toBe('no-frames');
    });
  });

  describe('drawable thresholds', () => {
    it.each<{ name: string; config: FieldConfig<GraphFieldConfig> }>([
      { name: 'the style is Off', config: { ...lineThresholds, custom: {} } },
      { name: 'there are no thresholds', config: { custom: lineThresholds.custom } },
      {
        name: 'there is only the base step',
        config: {
          ...lineThresholds,
          thresholds: { mode: ThresholdsMode.Absolute, steps: [lineThresholds.thresholds!.steps[0]] },
        },
      },
      {
        name: 'percentage steps have no min and max',
        config: { ...lineThresholds, thresholds: { ...lineThresholds.thresholds!, mode: ThresholdsMode.Percentage } },
      },
    ])('returns none when $name', ({ config }) => {
      expect(shapeOf({ defaults: config })).toBe('none');
    });

    it('returns no-frames for percentage steps with min and max', () => {
      const defaults = {
        ...lineThresholds,
        min: 0,
        max: 100,
        thresholds: { ...lineThresholds.thresholds!, mode: ThresholdsMode.Percentage },
      };

      expect(shapeOf({ defaults })).toBe('no-frames');
    });
  });
});

describe('buildNoValuesPlaceholderFrame', () => {
  // the app fills these registries at startup
  standardEditorsRegistry.setInit(getAllOptionEditors);
  standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

  const timeRange: TimeRange = {
    from: dateTime(1000),
    to: dateTime(5000),
    raw: { from: 'now-1h', to: 'now' },
  };

  const defaults: FieldConfig<GraphFieldConfig> = {
    unit: 'percent',
    custom: { thresholdsStyle: { mode: GraphThresholdsStyleMode.Dashed }, lineWidth: 3 },
    thresholds: {
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: 'green' },
        { value: 80, color: 'red' },
      ],
    },
  };

  const build = (overrides: FieldConfigSource['overrides'] = []) =>
    buildNoValuesPlaceholderFrame({
      timeRange,
      fieldConfig: { defaults, overrides },
      theme: createTheme(),
      replaceVariables: (v) => v,
    });

  const byType = (properties: FieldConfigSource['overrides'][number]['properties']) => [
    { matcher: { id: FieldMatcherID.byType, options: FieldType.number }, properties },
  ];

  it('spans the time range with null values', () => {
    const [time, value] = build().fields;

    expect(time.values).toEqual([1000, 5000]);
    expect(value.values).toEqual([null, null]);
  });

  it('carries the panel defaults, including custom options', () => {
    const { config } = build().fields[1];

    expect(config.unit).toBe('percent');
    expect(config.thresholds).toEqual(defaults.thresholds);
    expect(config.custom).toMatchObject({ thresholdsStyle: { mode: GraphThresholdsStyleMode.Dashed }, lineWidth: 3 });
  });

  it('hides the field from the legend and the tooltip, but not from the plot', () => {
    expect(build().fields[1].config.custom.hideFrom).toEqual({ legend: true, tooltip: true, viz: false });
  });

  it('formats values with the unit', () => {
    expect(build().fields[1].display!(50).suffix).toBe('%');
  });

  it('applies standard overrides', () => {
    const field = build(byType([{ id: 'unit', value: 'ms' }])).fields[1];

    expect(field.config.unit).toBe('ms');
  });

  it('does not apply custom overrides', () => {
    const field = build(byType([{ id: 'custom.lineWidth', value: 10 }])).fields[1];

    expect(field.config.custom.lineWidth).toBe(3);
  });

  it('is marked as a placeholder', () => {
    expect(isNoValuesPlaceholderFrame(build())).toBe(true);
    expect(isNoValuesPlaceholderFrame(createDataFrame({ fields: [] }))).toBe(false);
  });
});
