/**
 * Atomic test helpers for barchart utils.test.ts.
 * Extracted to keep the test file focused on assertions.
 */

import {
  createDataFrame,
  createTheme,
  DataFrame,
  FieldConfigSource,
  FieldType,
  getDisplayProcessor,
  GrafanaTheme2,
  MutableDataFrame,
} from '@grafana/data';
import {
  AxisColorMode,
  AxisPlacement,
  defaultTimeZone,
  FieldColorModeId,
  LegendDisplayMode,
  MappingType,
  SortOrder,
  StackingMode,
  ThresholdsMode,
  TooltipDisplayMode,
  VisibilityMode,
  VizOrientation,
} from '@grafana/schema';

import type { Options } from './panelcfg.gen';
import { type PrepConfigOpts, prepSeries } from './utils';

/** Empty FieldConfigSource for bar chart tests. */
export const EMPTY_FIELD_CONFIG: FieldConfigSource = {
  defaults: {},
  overrides: [],
};

const theme = createTheme();

/**
 * Ensures custom config exists and sets display processor on frame fields.
 */
export function applyBarChartFieldDefaults(frame: DataFrame, themeOverride?: GrafanaTheme2): void {
  const t = themeOverride ?? theme;
  frame.fields.forEach((f) => {
    f.config.custom = f.config.custom ?? {};
    f.display = getDisplayProcessor({ field: f, theme: t });
  });
}

/** Overrides for createStringXFrame. */
export interface CreateStringXFrameOverrides {
  xValues?: string[];
  values?: number[];
  xConfig?: Record<string, unknown>;
  valueConfig?: Record<string, unknown>;
  refId?: string;
}

/**
 * Creates a minimal bar chart DataFrame with string x-axis and numeric value.
 */
export function createStringXFrame(overrides?: CreateStringXFrameOverrides): DataFrame {
  const xValues = overrides?.xValues ?? ['a', 'b', 'c'];
  const values = overrides?.values ?? [10, 20, 30];
  const xConfig = overrides?.xConfig ?? { custom: {} };
  const valueConfig = overrides?.valueConfig ?? { unit: 'short', custom: {} };

  const frame = createDataFrame({
    refId: overrides?.refId,
    fields: [
      { name: 'x', type: FieldType.string, values: xValues, config: xConfig },
      { name: 'value', type: FieldType.number, values, config: valueConfig },
    ],
  });
  applyBarChartFieldDefaults(frame);
  return frame;
}

/** Overrides for createTimeXFrame. */
export interface CreateTimeXFrameOverrides {
  timeValues?: number[];
  values?: number[];
  refId?: string;
}

/**
 * Creates a minimal bar chart DataFrame with time x-axis and numeric value.
 */
export function createTimeXFrame(overrides?: CreateTimeXFrameOverrides): DataFrame {
  const timeValues = overrides?.timeValues ?? [1000, 2000, 3000];
  const values = overrides?.values ?? [10, 20, 30];

  const frame = createDataFrame({
    refId: overrides?.refId,
    fields: [
      { name: 'time', type: FieldType.time, values: timeValues, config: { custom: {} } },
      { name: 'value', type: FieldType.number, values, config: { unit: 'short', custom: {} } },
    ],
  });
  applyBarChartFieldDefaults(frame);
  return frame;
}

/** Overrides for createFrameWithColorField. */
export interface CreateFrameWithColorFieldOverrides {
  xValues?: string[];
  values?: number[];
  colorValues?: string[];
  colorFieldName?: string;
  colorMappings?: Array<{ value: string; text: string; color: string }>;
}

/**
 * Creates a bar chart DataFrame with a color string field (for color-by-field tests).
 */
export function createFrameWithColorField(overrides?: CreateFrameWithColorFieldOverrides): DataFrame {
  const xValues = overrides?.xValues ?? ['a', 'b', 'c'];
  const values = overrides?.values ?? [10, 20, 30];
  const colorValues = overrides?.colorValues ?? ['red', 'green', 'blue'];

  const colorOptions: Record<string, { text: string; color: string }> = {};
  colorValues.forEach((v) => {
    colorOptions[v] = { text: v, color: v };
  });

  const frame = createDataFrame({
    fields: [
      { name: 'x', type: FieldType.string, values: xValues, config: { custom: {} } },
      { name: 'value', type: FieldType.number, values, config: { unit: 'short', custom: {} } },
      {
        name: overrides?.colorFieldName ?? 'colorVal',
        type: FieldType.string,
        values: colorValues,
        config: {
          custom: { fillOpacity: 80 },
          mappings: [
            {
              type: MappingType.ValueToText,
              options: colorOptions,
            },
          ],
        },
      },
    ],
  });
  applyBarChartFieldDefaults(frame);
  return frame;
}

/** Overrides for createFrameWithThresholds. */
export interface CreateFrameWithThresholdsOverrides {
  xValues?: string[];
  values?: number[];
  steps?: Array<{ value: number; color: string }>;
}

/**
 * Creates a bar chart DataFrame with thresholds on the value field.
 */
export function createFrameWithThresholds(overrides?: CreateFrameWithThresholdsOverrides): DataFrame {
  const xValues = overrides?.xValues ?? ['a', 'b', 'c'];
  const values = overrides?.values ?? [10, 50, 90];
  const steps = overrides?.steps ?? [
    { value: 0, color: 'green' },
    { value: 50, color: 'yellow' },
    { value: 80, color: 'red' },
  ];

  const frame = createDataFrame({
    fields: [
      { name: 'x', type: FieldType.string, values: xValues, config: { custom: {} } },
      {
        name: 'value',
        type: FieldType.number,
        values,
        config: {
          unit: 'short',
          custom: {},
          color: { mode: FieldColorModeId.Thresholds },
          thresholds: {
            mode: ThresholdsMode.Absolute,
            steps: steps.map((s) => ({ value: s.value, color: s.color })),
          },
        },
      },
    ],
  });
  applyBarChartFieldDefaults(frame);
  return frame;
}

/** Overrides for createFrameWithMappings. */
export interface CreateFrameWithMappingsOverrides {
  xValues?: string[];
  values?: number[];
  mappings?: Array<{ value: string; text: string; color: string }>;
}

/**
 * Creates a bar chart DataFrame with value-to-text mappings on the value field.
 */
export function createFrameWithMappings(overrides?: CreateFrameWithMappingsOverrides): DataFrame {
  const xValues = overrides?.xValues ?? ['a', 'b', 'c'];
  const values = overrides?.values ?? [1, 2, 3];
  const mappings = overrides?.mappings ?? [
    { value: '1', text: 'Low', color: 'green' },
    { value: '2', text: 'Mid', color: 'yellow' },
  ];

  const options: Record<string, { text: string; color: string }> = {};
  mappings.forEach((m) => {
    options[m.value] = { text: m.text, color: m.color };
  });

  const frame = createDataFrame({
    fields: [
      { name: 'x', type: FieldType.string, values: xValues, config: { custom: {} } },
      {
        name: 'value',
        type: FieldType.number,
        values,
        config: {
          unit: 'short',
          custom: {},
          mappings: [
            {
              type: MappingType.ValueToText,
              options,
            },
          ],
        },
      },
    ],
  });
  applyBarChartFieldDefaults(frame);
  return frame;
}

/** Overrides for createFrameWithAxisConfig. */
export interface CreateFrameWithAxisConfigOverrides {
  xValues?: string[];
  values?: number[];
  axisPlacement?: AxisPlacement;
  axisBorderShow?: boolean;
  axisColorMode?: AxisColorMode;
  axisGridShow?: boolean;
  xAxisPlacement?: AxisPlacement;
}

/**
 * Creates a bar chart DataFrame with axis config on the value field (or x field for Hidden).
 */
export function createFrameWithAxisConfig(overrides?: CreateFrameWithAxisConfigOverrides): DataFrame {
  const xValues = overrides?.xValues ?? ['a', 'b', 'c'];
  const values = overrides?.values ?? [10, 20, 30];

  const xConfig = overrides?.xAxisPlacement ? { custom: { axisPlacement: overrides.xAxisPlacement } } : { custom: {} };

  const valueCustom: Record<string, unknown> = {};
  if (overrides?.axisPlacement !== undefined) {
    valueCustom.axisPlacement = overrides.axisPlacement;
  }
  if (overrides?.axisBorderShow !== undefined) {
    valueCustom.axisBorderShow = overrides.axisBorderShow;
  }
  if (overrides?.axisColorMode !== undefined) {
    valueCustom.axisColorMode = overrides.axisColorMode;
  }
  if (overrides?.axisGridShow !== undefined) {
    valueCustom.axisGridShow = overrides.axisGridShow;
  }

  const frame = createDataFrame({
    fields: [
      { name: 'x', type: FieldType.string, values: xValues, config: xConfig },
      {
        name: 'value',
        type: FieldType.number,
        values,
        config: {
          unit: 'short',
          custom: Object.keys(valueCustom).length > 0 ? valueCustom : {},
        },
      },
    ],
  });
  applyBarChartFieldDefaults(frame);
  return frame;
}

/** Options for prepBarChartSeries. */
export interface PrepBarChartSeriesOptions {
  stacking?: StackingMode;
  xFieldName?: string;
  colorFieldName?: string;
}

/**
 * Wraps prepSeries with default fieldConfig, stacking, and theme.
 */
export function prepBarChartSeries(
  frames: DataFrame[],
  opts?: PrepBarChartSeriesOptions
): ReturnType<typeof prepSeries> {
  return prepSeries(
    frames,
    EMPTY_FIELD_CONFIG,
    opts?.stacking ?? StackingMode.None,
    theme,
    opts?.xFieldName,
    opts?.colorFieldName
  );
}

/** Overrides for createPrepConfigOpts. */
export interface CreatePrepConfigOptsOverrides extends Partial<PrepConfigOpts> {
  options?: Partial<Options>;
}

/**
 * Creates default PrepConfigOpts with optional overrides.
 */
export function createPrepConfigOpts(overrides?: CreatePrepConfigOptsOverrides): PrepConfigOpts {
  const defaultOptions: Options = {
    orientation: VizOrientation.Auto,
    groupWidth: 20,
    barWidth: 2,
    showValue: VisibilityMode.Always,
    legend: {
      displayMode: LegendDisplayMode.List,
      showLegend: true,
      placement: 'bottom',
      calcs: [],
    },
    xTickLabelRotation: 0,
    xTickLabelMaxLength: 20,
    stacking: StackingMode.None,
    tooltip: {
      mode: TooltipDisplayMode.None,
      sort: SortOrder.None,
    },
    text: {
      valueSize: 10,
    },
    fullHighlight: false,
  };

  const baseSeries = createPreparedBarChartSeries();

  return {
    series: [baseSeries],
    totalSeries: 2,
    timeZone: defaultTimeZone,
    theme,
    orientation: VizOrientation.Auto,
    options: defaultOptions,
    ...overrides,
    series: overrides?.series ?? [baseSeries],
    options: { ...defaultOptions, ...overrides?.options },
  };
}

/** Overrides for createPreparedBarChartSeries. */
export interface CreatePreparedBarChartSeriesOverrides {
  xValues?: string[];
  values?: number[];
}

/**
 * Creates a prepared bar chart series for config tests. Replaces mockDataFrame().
 */
export function createPreparedBarChartSeries(overrides?: CreatePreparedBarChartSeriesOverrides): DataFrame {
  const frame = createStringXFrame({
    xValues: overrides?.xValues ?? ['a', 'b', 'c'],
    values: overrides?.values ?? [10, 20, 30],
  });
  const info = prepBarChartSeries([frame]);
  if (info.series.length === 0) {
    throw new Error('Bar chart not prepared correctly');
  }
  return info.series[0];
}

/**
 * Creates a MutableDataFrame with custom fields for edge-case tests (e.g. invalid types).
 */
export function createMutableFrame(
  fields: Array<{ name: string; type?: FieldType; values: unknown[]; config?: object }>
): MutableDataFrame {
  const df = new MutableDataFrame({ fields });
  df.fields.forEach((f) => (f.config.custom = f.config.custom ?? {}));
  return df;
}

/**
 * Creates a bar chart DataFrame with multiple string fields (for x field selection tests).
 */
export function createFrameWithMultipleStringFields(overrides?: {
  stringFields?: Array<{ name: string; values: string[] }>;
  valueField?: { name: string; values: number[] };
}): DataFrame {
  const stringFields = overrides?.stringFields ?? [
    { name: 'label', values: ['x', 'y', 'z'] },
    { name: 'other', values: ['a', 'b', 'c'] },
  ];
  const valueField = overrides?.valueField ?? { name: 'value', values: [1, 2, 3] };

  const fields = [
    ...stringFields.map((f) => ({
      name: f.name,
      type: FieldType.string as const,
      values: f.values,
      config: { custom: {} as object },
    })),
    {
      name: valueField.name,
      type: FieldType.number as const,
      values: valueField.values,
      config: { custom: {} as object },
    },
  ];
  const frame = createDataFrame({ fields });
  applyBarChartFieldDefaults(frame);
  return frame;
}

/**
 * Creates an empty DataFrame (length 0) for tests that verify empty response handling.
 */
export function createEmptyFrame(): DataFrame {
  return createDataFrame({
    fields: [
      { name: 'x', type: FieldType.string, values: [], config: { custom: {} } },
      { name: 'value', type: FieldType.number, values: [], config: { custom: {} } },
    ],
  });
}
