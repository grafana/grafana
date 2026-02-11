import {
  DataFrame,
  FALLBACK_COLOR,
  Field,
  FieldColorModeId,
  FieldConfig,
  FieldType,
  formattedValueToString,
  getFieldDisplayName,
  getValueFormat,
  GrafanaTheme2,
  getActiveThreshold,
  Threshold,
  getFieldConfigWithMinMax,
  ThresholdsMode,
  TimeRange,
  cacheFieldDisplayNames,
  outerJoinDataFrames,
  ValueMapping,
  ThresholdsConfig,
  applyNullInsertThreshold,
  nullToValue,
  SpecialValueMatch,
  DisplayValue,
} from '@grafana/data';
import { maybeSortFrame, NULL_RETAIN } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import {
  VizLegendOptions,
  AxisPlacement,
  ScaleDirection,
  ScaleOrientation,
  VisibilityMode,
  TimelineValueAlignment,
  HideableFieldConfig,
  MappingType,
} from '@grafana/schema';
import {
  StateTimelineLegendOptions,
  StateTimelineLegendReducers,
} from '@grafana/schema/dist/esm/raw/composable/statetimeline/panelcfg/x/StateTimelinePanelCfg_types.gen';
import { FIXED_UNIT, UPlotConfigBuilder, UPlotConfigPrepFn, VizLegendItem } from '@grafana/ui';
import { preparePlotData2, getStackingGroups } from '@grafana/ui/internal';

import { getConfig, TimelineCoreOptions } from './timeline';

/**
 * @internal
 */
interface UPlotConfigOptions {
  frame: DataFrame;
  theme: GrafanaTheme2;
  mode: TimelineMode;
  rowHeight?: number;
  colWidth?: number;
  showValue: VisibilityMode;
  alignValue?: TimelineValueAlignment;
  mergeValues?: boolean;
  getValueColor: (frameIdx: number, fieldIdx: number, value: unknown) => string;
  hoverMulti: boolean;
  axisWidth?: number;
}

/**
 * @internal
 */
interface PanelFieldConfig extends HideableFieldConfig {
  fillOpacity?: number;
  lineWidth?: number;
}

export enum TimelineMode {
  Changes = 'changes',
  Samples = 'samples',
}

const defaultConfig: PanelFieldConfig = {
  lineWidth: 0,
  fillOpacity: 80,
};

/** Checks if a mapped value of the specified type exists for the given field */
export const hasSpecialMappedValue = (field: Field, match: SpecialValueMatch): boolean =>
  field.config.mappings?.some(
    (mapping: ValueMapping): boolean => mapping.type === MappingType.SpecialValue && mapping.options.match === match
  ) || false;

export const preparePlotConfigBuilder: UPlotConfigPrepFn<UPlotConfigOptions> = ({
  frame,
  theme,
  timeZones,
  getTimeRange,
  mode,
  rowHeight,
  colWidth,
  showValue,
  alignValue,
  mergeValues,
  getValueColor,
  hoverMulti,
  xAxisConfig,
}) => {
  const builder = new UPlotConfigBuilder(timeZones[0]);

  const xScaleKey = 'x';

  const isDiscrete = (field: Field) => {
    const mode = field.config?.color?.mode;
    return !(mode && field.display && mode.startsWith('continuous-'));
  };
  const getValueColorFn = (seriesIdx: number, value: unknown) => {
    const field = frame.fields[seriesIdx];

    if (
      field.state?.origin?.fieldIndex !== undefined &&
      field.state?.origin?.frameIndex !== undefined &&
      getValueColor
    ) {
      return getValueColor(field.state?.origin?.frameIndex, field.state?.origin?.fieldIndex, value);
    }

    return FALLBACK_COLOR;
  };

  const opts: TimelineCoreOptions = {
    mode: mode!,
    numSeries: frame.fields.length - 1,
    isDiscrete: (seriesIdx) => isDiscrete(frame.fields[seriesIdx]),
    hasMappedNull: (seriesIdx) =>
      hasSpecialMappedValue(frame.fields[seriesIdx], SpecialValueMatch.Null) ||
      hasSpecialMappedValue(frame.fields[seriesIdx], SpecialValueMatch.NullAndNaN),
    hasMappedNaN: (seriesIdx) =>
      hasSpecialMappedValue(frame.fields[seriesIdx], SpecialValueMatch.NaN) ||
      hasSpecialMappedValue(frame.fields[seriesIdx], SpecialValueMatch.NullAndNaN),
    mergeValues,
    rowHeight: rowHeight,
    colWidth: colWidth,
    showValue: showValue!,
    alignValue,
    theme,
    label: (seriesIdx) => getFieldDisplayName(frame.fields[seriesIdx], frame),
    getFieldConfig: (seriesIdx) => frame.fields[seriesIdx].config.custom,
    getValueColor: getValueColorFn,
    getTimeRange,
    // hardcoded formatter for state values
    formatValue: (seriesIdx, value) => formattedValueToString(frame.fields[seriesIdx].display!(value)),
    hoverMulti,
  };

  const coreConfig = getConfig(opts);

  builder.addHook('init', coreConfig.init);
  builder.addHook('drawClear', coreConfig.drawClear);

  builder.setPrepData((frames) => preparePlotData2(frames[0], getStackingGroups(frames[0])));

  builder.setCursor(coreConfig.cursor);

  builder.addScale({
    scaleKey: xScaleKey,
    isTime: true,
    orientation: ScaleOrientation.Horizontal,
    direction: ScaleDirection.Right,
    range: (u) => {
      const state = builder.getState();
      if (state.isPanning) {
        if (state.isTimeRangePending) {
          const propsRange = coreConfig.xRange(u);
          const propsFrom = propsRange[0];
          const propsTo = propsRange[1];

          if (propsFrom != null && propsTo != null) {
            const MIN_TIMESPAN_MS = 1;
            const fromMatches = Math.abs(propsFrom - state.min) <= MIN_TIMESPAN_MS;
            const toMatches = Math.abs(propsTo - state.max) <= MIN_TIMESPAN_MS;
            const timeRangeHasUpdated = fromMatches && toMatches;

            if (timeRangeHasUpdated) {
              builder.setState({ isPanning: false });
              return propsRange;
            }
          }
        }

        return [state.min, state.max];
      }
      return coreConfig.xRange(u);
    },
  });

  builder.addScale({
    scaleKey: FIXED_UNIT, // y
    isTime: false,
    orientation: ScaleOrientation.Vertical,
    direction: ScaleDirection.Up,
    range: coreConfig.yRange,
  });

  const xField = frame.fields[0];
  const xAxisHidden = xField.config.custom?.axisPlacement === AxisPlacement.Hidden;

  builder.addAxis({
    show: !xAxisHidden,
    scaleKey: xScaleKey,
    isTime: true,
    splits: coreConfig.xSplits!,
    placement: AxisPlacement.Bottom,
    timeZone: timeZones[0],
    theme,
    formatValue: xField.config.unit?.startsWith('time:')
      ? (v, decimals) => xField.display!(v, decimals).text
      : undefined,
    ...xAxisConfig,
  });

  const yCustomConfig = frame.fields[1].config.custom;
  const yAxisWidth = yCustomConfig.axisWidth;
  const yAxisHidden = yCustomConfig.axisPlacement === AxisPlacement.Hidden;

  builder.addAxis({
    scaleKey: FIXED_UNIT, // y
    isTime: false,
    placement: AxisPlacement.Left,
    splits: coreConfig.ySplits,
    values: yAxisHidden ? (u, splits) => splits.map((v) => null) : coreConfig.yValues,
    grid: { show: false },
    ticks: { show: false },
    gap: yAxisHidden ? 0 : 16,
    size: yAxisHidden ? 0 : yAxisWidth,
    theme,
  });

  let seriesIndex = 0;

  for (let i = 0; i < frame.fields.length; i++) {
    if (i === 0) {
      continue;
    }

    const field = frame.fields[i];
    const config: FieldConfig<PanelFieldConfig> = field.config;
    const customConfig: PanelFieldConfig = {
      ...defaultConfig,
      ...config.custom,
    };

    field.state!.seriesIndex = seriesIndex++;

    // const scaleKey = config.unit || FIXED_UNIT;
    // const colorMode = getFieldColorModeForField(field);

    builder.addSeries({
      scaleKey: FIXED_UNIT,
      pathBuilder: coreConfig.drawPaths,
      pointsBuilder: coreConfig.drawPoints,
      //colorMode,
      lineWidth: customConfig.lineWidth,
      fillOpacity: customConfig.fillOpacity,
      theme,
      show: !customConfig.hideFrom?.viz,
      thresholds: config.thresholds,
      // The following properties are not used in the uPlot config, but are utilized as transport for legend config
      dataFrameFieldIndex: field.state?.origin,
    });
  }

  return builder;
};

function getSpanNulls(field: Field) {
  let spanNulls = field.config.custom?.spanNulls;

  // magic value for join() to leave nulls alone instead of expanding null ranges
  // should be set to -1 when spanNulls = null|undefined|false|0, which is "retain nulls, without expanding"
  // Infinity is not optimal here since it causes spanNulls to be more expensive than simply removing all nulls unconditionally
  return !spanNulls ? -1 : spanNulls === true ? Infinity : spanNulls;
}

/**
 * Merge values by the threshold
 */
export function mergeThresholdValues(field: Field, theme: GrafanaTheme2): Field | undefined {
  const thresholds = field.config.thresholds;
  if (field.type !== FieldType.number || !thresholds || !thresholds.steps.length) {
    return undefined;
  }

  const items = getThresholdItems(field.config, theme);
  if (items.length !== thresholds.steps.length) {
    return undefined; // should not happen
  }

  const thresholdToText = new Map<Threshold, string>();
  const textToColor = new Map<string, string>();
  for (let i = 0; i < items.length; i++) {
    thresholdToText.set(thresholds.steps[i], items[i].label);
    textToColor.set(items[i].label, items[i].color!);
  }

  let input = field.values;
  const vals = new Array<String | undefined>(field.values.length);
  if (thresholds.mode === ThresholdsMode.Percentage) {
    const { min, max } = getFieldConfigWithMinMax(field);
    const delta = max! - min!;
    input = input.map((v) => {
      if (v == null) {
        return v;
      }
      return ((v - min!) / delta) * 100;
    });
  }

  for (let i = 0; i < vals.length; i++) {
    const v = input[i];
    if (v == null) {
      vals[i] = v;
    } else {
      vals[i] = thresholdToText.get(getActiveThreshold(v, thresholds.steps));
    }
  }

  return {
    ...field,
    config: {
      ...field.config,
      custom: {
        ...field.config.custom,
        spanNulls: getSpanNulls(field),
      },
    },
    type: FieldType.string,
    values: vals,
    display: (value) => ({
      text: String(value),
      color: textToColor.get(String(value)),
      numeric: NaN,
    }),
  };
}

// This will return a set of frames with only graphable values included
export function prepareTimelineFields(
  series: DataFrame[] | undefined,
  mergeValues: boolean,
  timeRange: TimeRange,
  theme: GrafanaTheme2
): { frames?: DataFrame[]; warn?: string } {
  // this allows PanelDataErrorView to show the default noValue message
  if (!series?.length) {
    return { warn: '' };
  }

  cacheFieldDisplayNames(series);

  let hasTimeseries = false;
  const frames: DataFrame[] = [];

  for (let frame of series) {
    let startFieldIdx = -1;
    let endFieldIdx = -1;

    for (let i = 0; i < frame.fields.length; i++) {
      let f = frame.fields[i];

      if (f.type === FieldType.time && typeof f.values[0] === 'number') {
        if (startFieldIdx === -1) {
          startFieldIdx = i;
        } else if (endFieldIdx === -1) {
          endFieldIdx = i;
          break;
        }
      }
    }

    let isTimeseries = startFieldIdx !== -1;
    let changed = false;
    frame = maybeSortFrame(frame, startFieldIdx);

    // if we have a second time field, assume it is state end timestamps
    // and insert nulls into the data at the end timestamps
    if (endFieldIdx !== -1) {
      let startFrame: DataFrame = {
        ...frame,
        fields: frame.fields.filter((f, i) => i !== endFieldIdx),
      };

      let endFrame: DataFrame = {
        length: frame.length,
        fields: [frame.fields[endFieldIdx]],
      };

      frame = outerJoinDataFrames({
        frames: [startFrame, endFrame],
        keepDisplayNames: true,
        nullMode: () => NULL_RETAIN,
      })!;

      frame.fields.forEach((f, i) => {
        if (i > 0) {
          let vals = f.values;
          for (let i = 0; i < vals.length; i++) {
            if (vals[i] == null) {
              vals[i] = null;
            }
          }
        }
      });

      changed = true;
    }

    let nulledFrame = applyNullInsertThreshold({
      frame,
      refFieldPseudoMin: timeRange.from.valueOf(),
      refFieldPseudoMax: timeRange.to.valueOf(),
    });

    if (nulledFrame !== frame) {
      changed = true;
    }

    frame = nullToValue(nulledFrame);

    const fields: Field[] = [];
    for (let field of frame.fields) {
      switch (field.type) {
        case FieldType.time:
          if (typeof field.values[0] === 'number') {
            isTimeseries = true;
            hasTimeseries = true;
            fields.push(field);
          }
          break;
        case FieldType.enum:
        case FieldType.number:
          if (mergeValues && field.config.color?.mode === FieldColorModeId.Thresholds) {
            const f = mergeThresholdValues(field, theme);
            if (f) {
              fields.push(f);
              changed = true;
              continue;
            }
          }

        case FieldType.boolean:
        case FieldType.string:
          field = {
            ...field,
            config: {
              ...field.config,
              custom: {
                ...field.config.custom,
                spanNulls: getSpanNulls(field),
              },
            },
          };
          changed = true;
          fields.push(field);
          break;
        default:
          changed = true;
      }
    }
    if (isTimeseries && fields.length > 1) {
      hasTimeseries = true;
      if (changed) {
        frames.push({
          ...frame,
          fields,
        });
      } else {
        frames.push(frame);
      }
    }
  }

  if (!hasTimeseries) {
    return { warn: t('timeline.missing-field.time', 'Data does not have a time field') };
  }
  if (!frames.length) {
    return { warn: t('timeline.missing-field.all', 'No graphable fields') };
  }

  return { frames };
}

export function makeFramePerSeries(frames: DataFrame[]) {
  const outFrames: DataFrame[] = [];

  for (let frame of frames) {
    const timeFields = frame.fields.filter((field) => field.type === FieldType.time);

    if (timeFields.length > 0) {
      for (let field of frame.fields) {
        if (field.type !== FieldType.time) {
          outFrames.push({ fields: [...timeFields, field], length: frame.length });
        }
      }
    }
  }

  return outFrames;
}

export function getThresholdItems(
  fieldConfig: FieldConfig,
  theme: GrafanaTheme2,
  thresholdItems?: ThresholdsConfig
): VizLegendItem[] {
  const items: VizLegendItem[] = [];
  const thresholds = thresholdItems ? thresholdItems : fieldConfig.thresholds;
  if (!thresholds || !thresholds.steps.length) {
    return items;
  }

  const steps = thresholds.steps;
  const getDisplay = getValueFormat(
    thresholds.mode === ThresholdsMode.Percentage ? 'percent' : (fieldConfig.unit ?? '')
  );

  // `undefined` value for decimals will use `auto`
  const format = (value: number) => formattedValueToString(getDisplay(value, fieldConfig.decimals ?? undefined));

  for (let i = 0; i < steps.length; i++) {
    let step = steps[i];
    let value = step.value;
    let pre = '';
    let suf = '';

    if (value === -Infinity && i < steps.length - 1) {
      value = steps[i + 1].value;
      pre = '< ';
    } else {
      suf = '+';
    }

    items.push({
      label: `${pre}${format(value)}${suf}`,
      color: theme.visualization.getColorByName(step.color),
      yAxis: 1,
    });
  }

  return items;
}

export function getValueMappingItems(mappings: ValueMapping[], theme: GrafanaTheme2): VizLegendItem[] {
  const items: VizLegendItem[] = [];
  if (!mappings) {
    return items;
  }

  for (let mapping of mappings) {
    const { options, type } = mapping;

    if (type === MappingType.ValueToText) {
      for (let [label, value] of Object.entries(options)) {
        const color = value.color;
        items.push({
          label: label,
          color: theme.visualization.getColorByName(color ?? FALLBACK_COLOR),
          yAxis: 1,
        });
      }
    }

    if (type === MappingType.RangeToText) {
      const { from, result, to } = options;
      const { text, color } = result;
      const label = text ? `[${from} - ${to}] ${text}` : `[${from} - ${to}]`;

      items.push({
        label: label,
        color: theme.visualization.getColorByName(color ?? FALLBACK_COLOR),
        yAxis: 1,
      });
    }

    if (type === MappingType.RegexToText) {
      const { pattern, result } = options;
      const { text, color } = result;
      const label = `${text || pattern}`;

      items.push({
        label: label,
        color: theme.visualization.getColorByName(color ?? FALLBACK_COLOR),
        yAxis: 1,
      });
    }

    if (type === MappingType.SpecialValue) {
      const { match, result } = options;
      const { text, color } = result;
      const label = `${text || match}`;

      items.push({
        label: label,
        color: theme.visualization.getColorByName(color ?? FALLBACK_COLOR),
        yAxis: 1,
      });
    }
  }

  return items;
}

interface StateDurationInfo {
  duration: number;
  percentage: number;
  count: number;
}

interface DurationCalculationConfig {
  fields: Field[];
  timeRange: TimeRange;
  frame: DataFrame;
  reducers: StateTimelineLegendReducers[];
}

function calculateStateDurations(config: DurationCalculationConfig): Map<string, StateDurationInfo> | undefined {
  const { fields, timeRange, reducers = [] } = config;

  if (fields.length < 2 || reducers.length === 0) {
    return undefined;
  }

  const durations = new Map<string, StateDurationInfo>();

  const needsDuration = reducers.includes(StateTimelineLegendReducers.Duration);
  const needsPercentage = reducers.includes(StateTimelineLegendReducers.Percentage);
  const needsCount = reducers.includes(StateTimelineLegendReducers.Count);

  const needsTimeProcessing = needsDuration || needsPercentage;

  const timeField = needsTimeProcessing ? fields.find((f) => f.type === FieldType.time) : null;
  const timeValues = timeField?.values || null;

  if (needsTimeProcessing && !timeValues) {
    return undefined;
  }

  const rangeEnd = needsTimeProcessing ? timeRange.to.valueOf() : 0;
  const rangeStart = needsTimeProcessing ? timeRange.from.valueOf() : 0;
  const totalTimeRange = needsPercentage ? rangeEnd - rangeStart : 0;

  for (const field of fields) {
    if (field.type === FieldType.time) {
      continue;
    }

    const seriesName = getFieldDisplayName(field, config.frame);
    const values = field.values;
    let lastState: string | null = null;

    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      if (value == null) {
        continue;
      }

      const displayProcessor = field.display;
      const state = displayProcessor ? displayProcessor(value).text : String(value);
      const stateKey = `${seriesName}:${state}`;

      const currentInfo = durations.get(stateKey) ?? { duration: 0, percentage: 0, count: 0 };

      let newDuration = currentInfo.duration;
      let newPercentage = currentInfo.percentage;
      let newCount = currentInfo.count;

      if (needsTimeProcessing && timeValues) {
        const startTime = timeValues[i];
        const endTime = timeValues[i + 1] ?? rangeEnd;

        if (startTime != null && endTime != null && typeof startTime === 'number' && typeof endTime === 'number') {
          // Clamp duration to be within visible time range
          const clampedStartTime = Math.max(startTime, rangeStart);
          const clampedEndTime = Math.min(endTime, rangeEnd);

          if (clampedEndTime > clampedStartTime) {
            const duration = clampedEndTime - clampedStartTime;
            newDuration = currentInfo.duration + duration;

            if (needsPercentage) {
              newPercentage = (newDuration / totalTimeRange) * 100;
            }
          }
        }
      }

      if (needsCount) {
        newCount = lastState !== state ? currentInfo.count + 1 : currentInfo.count;
      }

      const updatedInfo: StateDurationInfo = {
        duration: newDuration,
        percentage: newPercentage,
        count: newCount,
      };

      durations.set(stateKey, updatedInfo);
      lastState = state;
    }
  }

  return durations;
}

const REDUCER_DISPLAYS: Record<StateTimelineLegendReducers, (info: StateDurationInfo) => DisplayValue> = {
  [StateTimelineLegendReducers.Duration]: (info) => ({
    title: 'Duration',
    description: 'Total time spent in this state',
    numeric: info.duration,
    text: fmtDuration(info.duration),
  }),
  [StateTimelineLegendReducers.Percentage]: (info) => ({
    title: 'Percentage',
    description: 'Percentage of time spent in this state relative to the entire time range',
    numeric: info.percentage,
    text: `${info.percentage.toFixed(2)}%`,
  }),
  [StateTimelineLegendReducers.Count]: (info) => ({
    title: 'Count',
    description: 'Number of times this state occurred',
    numeric: info.count,
    text: info.count.toString(),
  }),
};

function createTableLegendValues(info: StateDurationInfo, reducers: StateTimelineLegendReducers[]): DisplayValue[] {
  return reducers.map((reducer) => REDUCER_DISPLAYS[reducer](info));
}

function processSeriesGroups(
  seriesGroups: Map<string, Field[]>,
  durations: Map<string, StateDurationInfo> | undefined,
  options: StateTimelineLegendOptions | VizLegendOptions,
  theme: GrafanaTheme2,
  multipleSeries: boolean
): VizLegendItem[] {
  const allLegendItems: VizLegendItem[] = [];

  seriesGroups.forEach((fields, seriesName) => {
    const stateColors = new Map<string, string>();

    fields.forEach((field) => {
      field.values.forEach((v) => {
        const displayProcessor = field.display;
        if (displayProcessor) {
          const state = displayProcessor(v);
          if (state.color) {
            stateColors.set(state.text, state.color);
          }
        }
      });
    });

    stateColors.forEach((color, stateLabel) => {
      if (stateLabel.length > 0) {
        const info = durations ? durations.get(`${seriesName}:${stateLabel}`) : undefined;
        let label = multipleSeries ? `${seriesName}: ${stateLabel}` : stateLabel;

        let getDisplayValues: (() => DisplayValue[]) | undefined;

        if (
          options.displayMode === 'table' &&
          info &&
          'reducers' in options &&
          options.reducers &&
          options.reducers.length > 0
        ) {
          getDisplayValues = () => createTableLegendValues(info, options.reducers || []);
        }

        allLegendItems.push({
          label,
          color: theme.visualization.getColorByName(color ?? FALLBACK_COLOR),
          yAxis: 1,
          ...(getDisplayValues && { getDisplayValues }),
        });
      }
    });
  });

  return allLegendItems;
}

export function prepareTimelineLegendItems(
  frames: DataFrame[] | undefined,
  options: StateTimelineLegendOptions | VizLegendOptions,
  theme: GrafanaTheme2,
  timeRange?: TimeRange
): VizLegendItem[] | undefined {
  if (!frames || options.showLegend === false) {
    return undefined;
  }

  const seriesGroups = new Map<string, Field[]>();
  const durations = new Map<string, StateDurationInfo>();

  for (const frame of frames) {
    let frameDurations: Map<string, StateDurationInfo> | undefined;
    if (timeRange && 'reducers' in options && options.reducers && options.reducers.length > 0) {
      frameDurations = calculateStateDurations({
        fields: frame.fields,
        timeRange,
        frame,
        reducers: options.reducers,
      });
    }

    frame.fields.forEach((field) => {
      if (field.type === FieldType.time || field.config.custom?.hideFrom?.legend) {
        return;
      }

      const seriesName = getFieldDisplayName(field, frame);
      if (!seriesGroups.has(seriesName)) {
        seriesGroups.set(seriesName, []);
      }
      const seriesFields = seriesGroups.get(seriesName);
      if (seriesFields) {
        seriesFields.push(field);
      }
    });

    if (frameDurations) {
      frameDurations.forEach((info, key) => {
        durations.set(key, info);
      });
    }
  }

  const multipleSeries = frames.length > 1 || seriesGroups.size > 1;
  const allLegendItems = processSeriesGroups(seriesGroups, durations, options, theme, multipleSeries);
  return allLegendItems.length > 0 ? allLegendItems : undefined;
}

export function findNextStateIndex(field: Field, datapointIdx: number) {
  let end;
  let rightPointer = datapointIdx + 1;

  if (rightPointer >= field.values.length) {
    return null;
  }

  const startValue = field.values[datapointIdx];

  while (end === undefined) {
    if (rightPointer >= field.values.length) {
      return null;
    }
    const rightValue = field.values[rightPointer];

    if (rightValue === undefined || rightValue === startValue) {
      rightPointer++;
    } else {
      end = rightPointer;
    }
  }

  return end;
}

/**
 * Returns the precise duration of a time range passed in milliseconds.
 * This function calculates with 30 days month and 365 days year.
 * adapted from https://gist.github.com/remino/1563878
 * @param milliSeconds The duration in milliseconds
 * @returns A formatted string of the duration
 */
export function fmtDuration(milliSeconds: number): string {
  if (milliSeconds < 0 || Number.isNaN(milliSeconds)) {
    return '';
  }

  let yr: number, mo: number, wk: number, d: number, h: number, m: number, s: number, ms: number;

  s = Math.floor(milliSeconds / 1000);
  m = Math.floor(s / 60);
  s = s % 60;
  h = Math.floor(m / 60);
  m = m % 60;
  d = Math.floor(h / 24);
  h = h % 24;

  yr = Math.floor(d / 365);
  if (yr > 0) {
    d = d % 365;
  }

  mo = Math.floor(d / 30);
  if (mo > 0) {
    d = d % 30;
  }

  wk = Math.floor(d / 7);

  if (wk > 0) {
    d = d % 7;
  }

  ms = Math.round((milliSeconds % 1000) * 1000) / 1000;

  return (
    yr > 0
      ? yr + 'y ' + (mo > 0 ? mo + 'mo ' : '') + (wk > 0 ? wk + 'w ' : '') + (d > 0 ? d + 'd ' : '')
      : mo > 0
        ? mo + 'mo ' + (wk > 0 ? wk + 'w ' : '') + (d > 0 ? d + 'd ' : '')
        : wk > 0
          ? wk + 'w ' + (d > 0 ? d + 'd ' : '')
          : d > 0
            ? d + 'd ' + (h > 0 ? h + 'h ' : '')
            : h > 0
              ? h + 'h ' + (m > 0 ? m + 'm ' : '')
              : m > 0
                ? m + 'm ' + (s > 0 ? s + 's ' : '')
                : s > 0
                  ? s + 's ' + (ms > 0 ? ms + 'ms ' : '')
                  : ms > 0
                    ? ms + 'ms '
                    : '0'
  ).trim();
}
