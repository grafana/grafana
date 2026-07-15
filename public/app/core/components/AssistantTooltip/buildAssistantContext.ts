import { type ChatContextItem, createAssistantContextItem } from '@grafana/assistant';
import {
  type DataFrame,
  type Field,
  FieldType,
  formattedValueToString,
  getFieldDisplayName,
  type InterpolateFunction,
  type PanelProps,
  reduceField,
  ReducerID,
  type TimeRange,
} from '@grafana/data';

const EXEMPLAR_FRAME_NAME = 'exemplar';
const XYMARK_FRAME_NAME = 'xymark';
// Bound the context payload size.
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

/** Panel-level context for the tooltip's assistant button. */
export interface AssistantTooltipContext {
  panelId: number;
  panelTitle: string;
  timeRange: TimeRange;
  /** Pre-alignment frames; resolves the series' refId/query. */
  dataSeries: DataFrame[];
  /** Annotation + exemplar frames (PanelData.annotations). */
  annotations?: DataFrame[];
}

/** Builds the tooltip's assistant context from standard panel props. */
export function getAssistantTooltipContext(
  props: Pick<PanelProps, 'id' | 'title' | 'timeRange' | 'data'>
): AssistantTooltipContext {
  return {
    panelId: props.id,
    panelTitle: props.title,
    timeRange: props.timeRange,
    dataSeries: props.data.series,
    annotations: props.data.annotations,
  };
}

interface BuildArgs extends AssistantTooltipContext {
  /** uPlot-aligned frame (field 0 is x). */
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

/** Match window: the sampling interval around the hovered index. */
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

/** Builds a single context pill for a hovered data point. */
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
  const xDisp = formattedValueToString(xField.display!(xVal));
  const timestamp = isTime ? toIso(xVal) : xDisp;
  const displayValue = formattedValueToString(field.display!(value));
  const unit = field.config?.unit;
  const labels = field.labels ?? {};

  // Origin maps the aligned field back to its source frame.
  const origin = field.state?.origin;
  const sourceFrame = origin ? dataSeries[origin.frameIndex] : undefined;
  const refId = sourceFrame?.refId ?? alignedFrame.refId;
  const query = sourceFrame?.meta?.executedQueryString;

  const windowMs = isTime ? getStepMs(xField.values, xIdx) : 0;
  const matchedAnnotations = isTime ? matchAnnotations(annotations, xVal, windowMs) : [];

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

  const datapointItem = createAssistantContextItem('structured', {
    title: `${displayValue} @ ${xDisp} › ${seriesName} › ${panelTitle}`,
    icon: 'crosshair',
    data: {
      kind: 'viz-datapoint',
      point: {
        timestamp,
        value,
        displayValue,
        unit,
        ...(matchedAnnotations.length > 0 ? { annotations: matchedAnnotations } : {}),
      },
      series: {
        name: seriesName,
        labels,
        unit,
        refId,
        query,
        stats,
      },
      panel: {
        panelId,
        panelTitle,
        dashboardUid,
        dashboardTitle,
        timeRange: { from: timeRange.from.toISOString(), to: timeRange.to.toISOString() },
      },
    },
  });

  return [datapointItem];
}
