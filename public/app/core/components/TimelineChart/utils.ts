import React from 'react';
import uPlot from 'uplot';

import {
  DataFrame,
  DashboardCursorSync,
  DataHoverPayload,
  DataHoverEvent,
  DataHoverClearEvent,
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
} from '@grafana/data';
import { maybeSortFrame } from '@grafana/data/src/transformations/transformers/joinDataFrames';
import {
  VizLegendOptions,
  AxisPlacement,
  ScaleDirection,
  ScaleOrientation,
  VisibilityMode,
  TimelineValueAlignment,
  HideableFieldConfig,
} from '@grafana/schema';
import {
  FIXED_UNIT,
  SeriesVisibilityChangeMode,
  UPlotConfigBuilder,
  UPlotConfigPrepFn,
  VizLegendItem,
} from '@grafana/ui';
import { applyNullInsertThreshold } from '@grafana/ui/src/components/GraphNG/nullInsertThreshold';
import { nullToValue } from '@grafana/ui/src/components/GraphNG/nullToValue';
import { PlotTooltipInterpolator } from '@grafana/ui/src/components/uPlot/types';
import { preparePlotData2, getStackingGroups } from '@grafana/ui/src/components/uPlot/utils';

import { getConfig, TimelineCoreOptions } from './timeline';

/**
 * @internal
 */
interface UPlotConfigOptions {
  frame: DataFrame;
  theme: GrafanaTheme2;
  mode: TimelineMode;
  sync?: () => DashboardCursorSync;
  rowHeight?: number;
  colWidth?: number;
  showValue: VisibilityMode;
  alignValue?: TimelineValueAlignment;
  mergeValues?: boolean;
  getValueColor: (frameIdx: number, fieldIdx: number, value: unknown) => string;
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

export function mapMouseEventToMode(event: React.MouseEvent): SeriesVisibilityChangeMode {
  if (event.ctrlKey || event.metaKey || event.shiftKey) {
    return SeriesVisibilityChangeMode.AppendToSelection;
  }
  return SeriesVisibilityChangeMode.ToggleSelection;
}

export const preparePlotConfigBuilder: UPlotConfigPrepFn<UPlotConfigOptions> = ({
  frame,
  theme,
  timeZones,
  getTimeRange,
  mode,
  eventBus,
  sync,
  rowHeight,
  colWidth,
  showValue,
  alignValue,
  mergeValues,
  getValueColor,
}) => {
  const builder = new UPlotConfigBuilder(timeZones[0]);

  const xScaleUnit = 'time';
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
    onHover: (seriesIndex, valueIndex) => {
      hoveredSeriesIdx = seriesIndex;
      hoveredDataIdx = valueIndex;
      shouldChangeHover = true;
    },
    onLeave: () => {
      hoveredSeriesIdx = null;
      hoveredDataIdx = null;
      shouldChangeHover = true;
    },
  };

  let shouldChangeHover = false;
  let hoveredSeriesIdx: number | null = null;
  let hoveredDataIdx: number | null = null;

  const coreConfig = getConfig(opts);
  const payload: DataHoverPayload = {
    point: {
      [xScaleUnit]: null,
      [FIXED_UNIT]: null,
    },
    data: frame,
  };

  builder.addHook('init', coreConfig.init);
  builder.addHook('drawClear', coreConfig.drawClear);
  builder.addHook('setCursor', coreConfig.setCursor);

  // in TooltipPlugin, this gets invoked and the result is bound to a setCursor hook
  // which fires after the above setCursor hook, so can take advantage of hoveringOver
  // already set by the above onHover/onLeave callbacks that fire from coreConfig.setCursor
  const interpolateTooltip: PlotTooltipInterpolator = (
    updateActiveSeriesIdx,
    updateActiveDatapointIdx,
    updateTooltipPosition
  ) => {
    if (shouldChangeHover) {
      if (hoveredSeriesIdx != null) {
        updateActiveSeriesIdx(hoveredSeriesIdx);
        updateActiveDatapointIdx(hoveredDataIdx);
      }

      shouldChangeHover = false;
    }

    updateTooltipPosition(hoveredSeriesIdx == null);
  };

  builder.setTooltipInterpolator(interpolateTooltip);

  builder.setPrepData((frames) => preparePlotData2(frames[0], getStackingGroups(frames[0])));

  builder.setCursor(coreConfig.cursor);

  builder.addScale({
    scaleKey: xScaleKey,
    isTime: true,
    orientation: ScaleOrientation.Horizontal,
    direction: ScaleDirection.Right,
    range: coreConfig.xRange,
  });

  builder.addScale({
    scaleKey: FIXED_UNIT, // y
    isTime: false,
    orientation: ScaleOrientation.Vertical,
    direction: ScaleDirection.Up,
    range: coreConfig.yRange,
  });

  builder.addAxis({
    scaleKey: xScaleKey,
    isTime: true,
    splits: coreConfig.xSplits!,
    placement: AxisPlacement.Bottom,
    timeZone: timeZones[0],
    theme,
    grid: { show: true },
  });

  builder.addAxis({
    scaleKey: FIXED_UNIT, // y
    isTime: false,
    placement: AxisPlacement.Left,
    splits: coreConfig.ySplits,
    values: coreConfig.yValues,
    grid: { show: false },
    ticks: { show: false },
    gap: 16,
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

  if (sync && sync() !== DashboardCursorSync.Off) {
    let cursor: Partial<uPlot.Cursor> = {};

    cursor.sync = {
      key: '__global_',
      filters: {
        pub: (type: string, src: uPlot, x: number, y: number, w: number, h: number, dataIdx: number) => {
          if (sync && sync() === DashboardCursorSync.Off) {
            return false;
          }
          payload.rowIndex = dataIdx;
          if (x < 0 && y < 0) {
            payload.point[xScaleUnit] = null;
            payload.point[FIXED_UNIT] = null;
            eventBus.publish(new DataHoverClearEvent());
          } else {
            payload.point[xScaleUnit] = src.posToVal(x, xScaleKey);
            payload.point.panelRelY = y > 0 ? y / h : 1; // used for old graph panel to position tooltip
            payload.down = undefined;
            eventBus.publish(new DataHoverEvent(payload));
          }
          return true;
        },
      },
      scales: [xScaleKey, null],
    };
    builder.setSync();
    builder.setCursor(cursor);
  }

  return builder;
};

export function getNamesToFieldIndex(frame: DataFrame): Map<string, number> {
  const names = new Map<string, number>();
  for (let i = 0; i < frame.fields.length; i++) {
    names.set(getFieldDisplayName(frame.fields[i], frame), i);
  }
  return names;
}

/**
 * If any sequential duplicate values exist, this will return a new array
 * with the future values set to undefined.
 *
 * in:  1,        1,undefined,        1,2,        2,null,2,3
 * out: 1,undefined,undefined,undefined,2,undefined,null,2,3
 */
export function unsetSameFutureValues(values: unknown[]): unknown[] | undefined {
  let prevVal = values[0];
  let clone: unknown[] | undefined = undefined;

  for (let i = 1; i < values.length; i++) {
    let value = values[i];

    if (value === null) {
      prevVal = null;
    } else {
      if (value === prevVal) {
        if (!clone) {
          clone = [...values];
        }
        clone[i] = undefined;
      } else if (value != null) {
        prevVal = value;
      }
    }
  }
  return clone;
}

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

  let input = field.values.toArray();
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
  if (!series?.length) {
    return { warn: 'No data in response' };
  }
  let hasTimeseries = false;
  const frames: DataFrame[] = [];

  for (let frame of series) {
    let isTimeseries = false;
    let changed = false;
    let maybeSortedFrame = maybeSortFrame(
      frame,
      frame.fields.findIndex((f) => f.type === FieldType.time)
    );

    let nulledFrame = applyNullInsertThreshold({
      frame: maybeSortedFrame,
      refFieldPseudoMin: timeRange.from.valueOf(),
      refFieldPseudoMax: timeRange.to.valueOf(),
    });

    if (nulledFrame !== frame) {
      changed = true;
    }

    const fields: Field[] = [];
    for (let field of nullToValue(nulledFrame).fields) {
      switch (field.type) {
        case FieldType.time:
          isTimeseries = true;
          hasTimeseries = true;
          fields.push(field);
          break;
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
          ...maybeSortedFrame,
          fields,
        });
      } else {
        frames.push(maybeSortedFrame);
      }
    }
  }

  if (!hasTimeseries) {
    return { warn: 'Data does not have a time field' };
  }
  if (!frames.length) {
    return { warn: 'No graphable fields' };
  }
  return { frames };
}

export function getThresholdItems(fieldConfig: FieldConfig, theme: GrafanaTheme2): VizLegendItem[] {
  const items: VizLegendItem[] = [];
  const thresholds = fieldConfig.thresholds;
  if (!thresholds || !thresholds.steps.length) {
    return items;
  }

  const steps = thresholds.steps;
  const disp = getValueFormat(thresholds.mode === ThresholdsMode.Percentage ? 'percent' : fieldConfig.unit ?? '');

  const fmt = (v: number) => formattedValueToString(disp(v));

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
      label: `${pre}${fmt(value)}${suf}`,
      color: theme.visualization.getColorByName(step.color),
      yAxis: 1,
    });
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

  return getFieldLegendItem(allNonTimeFields(frames), theme);
}

export function getFieldLegendItem(fields: Field[], theme: GrafanaTheme2): VizLegendItem[] | undefined {
  if (!fields.length) {
    return undefined;
  }

  const items: VizLegendItem[] = [];
  const fieldConfig = fields[0].config;
  const colorMode = fieldConfig.color?.mode ?? FieldColorModeId.Fixed;
  const thresholds = fieldConfig.thresholds;

  // If thresholds are enabled show each step in the legend
  if (colorMode === FieldColorModeId.Thresholds && thresholds?.steps && thresholds.steps.length > 1) {
    return getThresholdItems(fieldConfig, theme);
  }

  // If thresholds are enabled show each step in the legend
  if (colorMode.startsWith('continuous')) {
    return undefined; // eventually a color bar
  }

  let stateColors: Map<string, string | undefined> = new Map();

  fields.forEach((field) => {
    field.values.toArray().forEach((v) => {
      let state = field.display!(v);
      if (state.color) {
        stateColors.set(state.text, state.color!);
      }
    });
  });

  stateColors.forEach((color, label) => {
    if (label.length > 0) {
      items.push({
        label: label!,
        color: theme.visualization.getColorByName(color ?? FALLBACK_COLOR),
        yAxis: 1,
      });
    }
  });

  return items;
}

function allNonTimeFields(frames: DataFrame[]): Field[] {
  const fields: Field[] = [];
  for (const frame of frames) {
    for (const field of frame.fields) {
      if (field.type !== FieldType.time) {
        fields.push(field);
      }
    }
  }
  return fields;
}

export function findNextStateIndex(field: Field, datapointIdx: number) {
  let end;
  let rightPointer = datapointIdx + 1;

  if (rightPointer >= field.values.length) {
    return null;
  }

  const startValue = field.values.get(datapointIdx);

  while (end === undefined) {
    if (rightPointer >= field.values.length) {
      return null;
    }
    const rightValue = field.values.get(rightPointer);

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
 * @returns A formated string of the duration
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
