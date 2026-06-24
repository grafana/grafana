import { type ChatContextItem, createAssistantContextItem } from '@grafana/assistant';
import {
  type DataFrame,
  type Field,
  FieldType,
  formattedValueToString,
  getFieldDisplayName,
  type InterpolateFunction,
  reduceField,
  ReducerID,
  type TimeRange,
} from '@grafana/data';

const EXEMPLAR_FRAME_NAME = 'exemplar';
const XYMARK_FRAME_NAME = 'xymark';
const EXEMPLAR_TIME_FIELD = 'Time';
const EXEMPLAR_VALUE_FIELD = 'Value';
// Cap how many annotations/exemplars we attach so the context payload stays bounded.
const MAX_MATCHES = 5;

const SERIES_REDUCERS = [
  ReducerID.min,
  ReducerID.max,
  ReducerID.mean,
  ReducerID.last,
  ReducerID.first,
  ReducerID.count,
  ReducerID.sum,
  ReducerID.range,
  ReducerID.stdDev,
];

/** Panel-level inputs assembled in TimeSeriesPanel and threaded down to the tooltip button. */
export interface AssistantTooltipContext {
  panelId: number;
  panelTitle: string;
  timeRange: TimeRange;
  /** Pre-alignment frames; used to resolve the hovered series' refId/query. */
  dataSeries: DataFrame[];
  /** Annotation + exemplar frames (PanelData.annotations). */
  annotations?: DataFrame[];
}

interface BuildArgs extends AssistantTooltipContext {
  /** uPlot-aligned frame (field 0 is the x/time field). */
  alignedFrame: DataFrame;
  seriesIdx: number;
  dataIdxs: Array<number | null>;
  replaceVariables: InterpolateFunction;
}

function findField(frame: DataFrame, name: string): Field | undefined {
  return frame.fields.find((f) => f.name.toLowerCase() === name.toLowerCase());
}

function toIso(value: number): string {
  return new Date(value).toISOString();
}

/** Returns undefined when the macro wasn't interpolated (e.g. in Explore). */
function resolveMacro(replaceVariables: InterpolateFunction, macro: string): string | undefined {
  const out = replaceVariables(macro);
  return out && !out.includes('${') ? out : undefined;
}

/** Sampling interval around the hovered index, used as the annotation/exemplar match window. */
function getStepMs(xValues: number[], idx: number): number {
  const cur = xValues[idx];
  const next = xValues[idx + 1];
  const prev = xValues[idx - 1];
  if (cur != null && next != null) {
    return Math.abs(next - cur);
  }
  if (cur != null && prev != null) {
    return Math.abs(cur - prev);
  }
  return 0;
}

function matchAnnotations(frames: DataFrame[], xVal: number, windowMs: number) {
  const matches: Array<Record<string, unknown>> = [];
  for (const frame of frames) {
    if (frame.name === EXEMPLAR_FRAME_NAME || frame.name === XYMARK_FRAME_NAME) {
      continue;
    }
    const timeF = findField(frame, 'time');
    if (!timeF) {
      continue;
    }
    const timeEndF = findField(frame, 'timeEnd');
    const titleF = findField(frame, 'title');
    const textF = findField(frame, 'text');
    const tagsF = findField(frame, 'tags');

    for (let i = 0; i < frame.length; i++) {
      const t = timeF.values[i];
      const tEnd = timeEndF?.values[i];
      const inRegion = tEnd != null ? xVal >= t && xVal <= tEnd : false;
      const nearPoint = Math.abs(t - xVal) <= windowMs;
      if (inRegion || nearPoint) {
        matches.push({
          time: toIso(t),
          ...(tEnd != null ? { timeEnd: toIso(tEnd) } : {}),
          ...(titleF?.values[i] != null ? { title: titleF.values[i] } : {}),
          ...(typeof textF?.values[i] === 'string' ? { text: textF.values[i] } : {}),
          ...(tagsF?.values[i] != null ? { tags: tagsF.values[i] } : {}),
        });
        if (matches.length >= MAX_MATCHES) {
          return matches;
        }
      }
    }
  }
  return matches;
}

function matchExemplars(frames: DataFrame[], xVal: number, windowMs: number) {
  const matches: Array<Record<string, unknown>> = [];
  for (const frame of frames) {
    if (frame.name !== EXEMPLAR_FRAME_NAME) {
      continue;
    }
    const timeF = findField(frame, EXEMPLAR_TIME_FIELD) ?? frame.fields.find((f) => f.type === FieldType.time);
    const valueF = findField(frame, EXEMPLAR_VALUE_FIELD) ?? frame.fields.find((f) => f.type === FieldType.number);
    if (!timeF) {
      continue;
    }
    // String fields carry exemplar identity (traceID, spanID, etc.).
    const stringFields = frame.fields.filter((f) => f.type === FieldType.string);

    for (let i = 0; i < frame.length; i++) {
      const t = timeF.values[i];
      if (Math.abs(t - xVal) <= windowMs) {
        const extra: Record<string, unknown> = {};
        for (const sf of stringFields) {
          extra[sf.name] = sf.values[i];
        }
        matches.push({ time: toIso(t), ...(valueF != null ? { value: valueF.values[i] } : {}), ...extra });
        if (matches.length >= MAX_MATCHES) {
          return matches;
        }
      }
    }
  }
  return matches;
}

/** Builds the point, series and panel context pills for a hovered data point. */
export function buildDatapointAssistantContext({
  alignedFrame,
  seriesIdx,
  dataIdxs,
  dataSeries,
  annotations = [],
  panelId,
  panelTitle,
  timeRange,
  replaceVariables,
}: BuildArgs): ChatContextItem[] {
  const xField = alignedFrame.fields[0];
  const field = alignedFrame.fields[seriesIdx];
  const xIdx = dataIdxs[0];
  const dataIdx = dataIdxs[seriesIdx];

  if (xField == null || field == null || xIdx == null || dataIdx == null) {
    return [];
  }

  const seriesName = getFieldDisplayName(field, alignedFrame);
  const xVal = xField.values[xIdx];
  const value = field.values[dataIdx];
  const isTime = xField.type === FieldType.time;
  // Formatted x (respects the panel's time format/zone), used for the pill label.
  const xDisp = formattedValueToString(xField.display!(xVal));
  const timestamp = isTime ? toIso(xVal) : xDisp;
  const displayValue = formattedValueToString(field.display!(value));
  const unit = field.config?.unit;
  const labels = field.labels ?? {};

  // The aligned field's origin points back to the source frame and its query.
  const origin = field.state?.origin;
  const sourceFrame = origin ? dataSeries[origin.frameIndex] : undefined;
  const refId = sourceFrame?.refId ?? alignedFrame.refId;
  const query = sourceFrame?.meta?.executedQueryString;

  const windowMs = isTime ? getStepMs(xField.values, xIdx) : 0;
  const matchedAnnotations = isTime ? matchAnnotations(annotations, xVal, windowMs) : [];
  const matchedExemplars = isTime ? matchExemplars(annotations, xVal, windowMs) : [];

  const calcs = reduceField({ field, reducers: SERIES_REDUCERS });
  const stats = {
    min: calcs[ReducerID.min],
    max: calcs[ReducerID.max],
    mean: calcs[ReducerID.mean],
    last: calcs[ReducerID.last],
    first: calcs[ReducerID.first],
    sum: calcs[ReducerID.sum],
    count: calcs[ReducerID.count],
    range: calcs[ReducerID.range],
    stdDev: calcs[ReducerID.stdDev],
  };

  const dashboardUid = resolveMacro(replaceVariables, '${__dashboard.uid}');
  const dashboardTitle = resolveMacro(replaceVariables, '${__dashboard.title}');

  const pointItem = createAssistantContextItem('structured', {
    title: `Point: ${displayValue} @ ${xDisp}`,
    icon: 'crosshair',
    data: {
      kind: 'timeseries-datapoint',
      series: seriesName,
      labels,
      timestamp,
      value,
      displayValue,
      unit,
      ...(matchedAnnotations.length > 0 ? { annotations: matchedAnnotations } : {}),
      ...(matchedExemplars.length > 0 ? { exemplars: matchedExemplars } : {}),
    },
  });

  const seriesItem = createAssistantContextItem('structured', {
    title: `Series: ${seriesName}`,
    icon: 'chart-line',
    data: {
      kind: 'timeseries-series',
      name: seriesName,
      labels,
      unit,
      refId,
      query,
      stats,
    },
  });

  const panelItem = createAssistantContextItem('structured', {
    title: `Panel: ${panelTitle}`,
    icon: 'apps',
    data: {
      kind: 'dashboard-panel',
      panelId,
      panelTitle,
      dashboardUid,
      dashboardTitle,
      timeRange: { from: timeRange.from.toISOString(), to: timeRange.to.toISOString() },
    },
  });

  return [pointItem, seriesItem, panelItem];
}
