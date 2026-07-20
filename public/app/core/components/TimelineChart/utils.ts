import {
  type DataFrame,
  type EnumFieldConfig,
  FALLBACK_COLOR,
  type Field,
  type FieldConfig,
  FieldType,
  formattedValueToString,
  getDisplayProcessor,
  getFieldDisplayName,
  getValueFormat,
  type GrafanaTheme2,
  ThresholdsMode,
  type TimeRange,
  cacheFieldDisplayNames,
  outerJoinDataFrames,
  type ValueMapping,
  type ThresholdsConfig,
  applyNullInsertThreshold,
  nullToValue,
  SpecialValueMatch,
} from '@grafana/data';
import { maybeSortFrame, NULL_RETAIN } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import {
  type VizLegendOptions,
  AxisPlacement,
  ScaleDirection,
  ScaleOrientation,
  type VisibilityMode,
  type TimelineValueAlignment,
  type HideableFieldConfig,
  MappingType,
} from '@grafana/schema';
import { FIXED_UNIT, UPlotConfigBuilder, type UPlotConfigPrepFn, type VizLegendItem } from '@grafana/ui';
import { preparePlotData2, getStackingGroups } from '@grafana/ui/internal';
import { getEnumConfig, type FieldColorValues } from 'app/plugins/panel/xychart/scatter';

import { getConfig, type TimelineCoreOptions } from './timeline';

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

// getEnumConfig emits hex8 colors; strip the opaque alpha suffix so the renderer's
// getFillColor() does not mistake it for an explicit alpha and skip fillOpacity
const stripOpaqueAlpha = (color: string) => (color.length === 9 && color.endsWith('ff') ? color.slice(0, 7) : color);

/**
 * Converts a value field to an enum field whose values are state indices and whose
 * config.type.enum lookup holds each state's text/color/icon. States come from the field's
 * value mappings or absolute thresholds (via getEnumConfig); fields without either get one
 * state per distinct raw value, formatted and colored by the field's display processor.
 */
export function toEnumField(field: Field, theme: GrafanaTheme2): Field {
  const custom = {
    ...field.config.custom,
    spanNulls: getSpanNulls(field),
  };

  const hasMappings = (field.config.mappings?.length ?? 0) > 0;

  // already-enum fields pass through untouched, as do continuous color schemes (gradient render
  // path) without mappings. mappings win over continuous color modes, same as in getEnumConfig,
  // since continuous-GrYlRd is the panel-wide default that mappings are layered onto.
  if (field.type === FieldType.enum || (!hasMappings && field.config.color?.mode?.startsWith('continuous'))) {
    return {
      ...field,
      config: {
        ...field.config,
        custom,
      },
    };
  }

  const noStates: Pick<FieldColorValues, 'index' | 'getAll'> = { index: {}, getAll: () => [] };

  // mappings compile to states for all field types, thresholds only for numeric values
  const { index, getAll } = hasMappings || field.type === FieldType.number ? getEnumConfig(field, theme) : noStates;

  const enumConfig: EnumFieldConfig = {
    color: (index.color ?? []).map((c) => stripOpaqueAlpha(String(c))),
    text: (index.text ?? []).slice(),
    icon: (index.icon ?? []).slice(),
  };

  const values: Array<number | null | undefined> = Array(field.values.length);

  if (enumConfig.text!.length > 0) {
    // states from mappings or absolute thresholds
    const idxs = getAll(field.values);
    let otherIdx = -1;

    for (let i = 0; i < values.length; i++) {
      const raw = field.values[i];

      if (raw === undefined) {
        values[i] = undefined;
      } else if (raw === null || (typeof raw === 'number' && Number.isNaN(raw))) {
        // null/NaN can only become states via special value mappings;
        // the compiled thresholds matcher would coerce them to step 0, so gate on mappings
        values[i] = hasMappings && idxs[i] !== -1 ? idxs[i] : null;
      } else if (idxs[i] !== -1) {
        values[i] = idxs[i];
      } else {
        // collapse all unmapped values into a single fallback state
        if (otherIdx === -1) {
          otherIdx = enumConfig.text!.length;
          enumConfig.text!.push(t('timeline.enum-state.other', 'Other'));
          enumConfig.color!.push(FALLBACK_COLOR);
          enumConfig.icon!.push('');
        }
        values[i] = otherIdx;
      }
    }
  } else {
    // no mappings/thresholds: each distinct raw value becomes a state, deduped by text+color
    const display = field.display ?? getDisplayProcessor({ field, theme });
    const idxByRawValue = new Map<unknown, number>();
    const idxByStateKey = new Map<string, number>();

    for (let i = 0; i < values.length; i++) {
      const raw = field.values[i];

      if (raw === undefined) {
        values[i] = undefined;
      } else if (raw === null || (typeof raw === 'number' && Number.isNaN(raw))) {
        values[i] = null;
      } else {
        let idx = idxByRawValue.get(raw);

        if (idx == null) {
          const disp = display(raw);
          const text = formattedValueToString(disp);
          // set color explicitly so the enum display processor does not fall back to palette cycling
          const color = disp.color ?? FALLBACK_COLOR;
          const key = `${color}|${text}`;

          idx = idxByStateKey.get(key);

          if (idx == null) {
            idx = enumConfig.text!.length;
            idxByStateKey.set(key, idx);
            enumConfig.text!.push(text);
            enumConfig.color!.push(color);
            enumConfig.icon!.push('');
          }

          idxByRawValue.set(raw, idx);
        }

        values[i] = idx;
      }
    }
  }

  const enumField: Field = {
    ...field,
    type: FieldType.enum,
    values,
    config: {
      ...field.config,
      // the display processor prefers mappings over the enum index, so drop them
      mappings: undefined,
      custom,
      type: {
        ...field.config.type,
        enum: enumConfig,
      },
    },
  };

  enumField.display = getDisplayProcessor({ field: enumField, theme });

  return enumField;
}

/**
 * Replaces consecutive duplicate values with `undefined`, which the join and renderer treat as
 * "no state change here" (the previous box simply extends through it). This merges equal
 * consecutive values at the data level, so the renderer, tooltip duration, and legend all see
 * the same state runs. `undefined` samples are skipped (they are already merged/holes), and
 * nulls always terminate a run (a null is a gap, never merged).
 */
export function mergeConsecutiveValues<T>(values: T[]): Array<T | undefined> {
  const merged: Array<T | undefined> = Array(values.length);
  let prev: T | undefined = undefined;

  for (let i = 0; i < values.length; i++) {
    const val = values[i];

    if (val === undefined) {
      merged[i] = undefined;
    } else {
      // NaN !== NaN, so NaN samples never merge (same as the old renderer comparison)
      merged[i] = val !== null && val === prev ? undefined : val;
      prev = val;
    }
  }

  return merged;
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
        case FieldType.boolean:
        case FieldType.string: {
          // toEnumField always returns a fresh Field object, so replacing its values is safe
          const enumField = toEnumField(field, theme);

          if (mergeValues) {
            enumField.values = mergeConsecutiveValues(enumField.values);
          }

          fields.push(enumField);
          changed = true;
          break;
        }
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

export function prepareTimelineLegendItems(
  frames: DataFrame[] | undefined,
  options: VizLegendOptions,
  theme: GrafanaTheme2
): VizLegendItem[] | undefined {
  if (!frames || options.showLegend === false) {
    return undefined;
  }

  const items: VizLegendItem[] = [];
  const seen = new Set<string>();

  for (const frame of frames) {
    for (const field of frame.fields) {
      if (field.type === FieldType.time || field.config.custom?.hideFrom?.legend) {
        continue;
      }

      // continuous color schemes remain non-enum and contribute no legend items (eventually a color bar)
      const { text = [], color = [] } = field.config.type?.enum ?? {};

      for (let i = 0; i < text.length; i++) {
        const label = text[i];
        const stateColor = color[i] ?? FALLBACK_COLOR;
        const key = `${stateColor}|${label}`;

        if (label != null && label !== '' && !seen.has(key)) {
          seen.add(key);

          items.push({
            label,
            color: theme.visualization.getColorByName(stateColor),
            yAxis: 1,
          });
        }
      }
    }
  }

  // e.g. all-continuous fields produce no items and should render no legend at all
  return items.length > 0 ? items : undefined;
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
