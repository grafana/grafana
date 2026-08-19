import {
  type DataFrame,
  type DataLink,
  type DataLinkPostProcessor,
  type DataSourceInstanceSettings,
  type DataSourceJsonData,
  dateTime,
  type Field,
  FieldType,
  type LinkModel,
  mapInternalLinkToExplore,
  rangeUtil,
  type ScopedVars,
  type SplitOpen,
  type TimeRange,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { type TraceToLogsOptionsV2 } from '@grafana/o11y-ds-frontend';
import { getTemplateSrv } from '@grafana/runtime';

import { getVariableUsageInfo } from '../utils/links';

import { getLogsButtonCTA } from './components/TraceTimelineViewer/SpanDetail/LogsLink';
import { getTraceToLogsTraceQuery, interpolateQueries } from './components/logsLink';
import { type Trace } from './components/types/trace';

/**
 * Builds an Explore link model for related logs at the trace level (no span id filter).
 */
export function createTraceLogsLink({
  splitOpenFn,
  traceToLogsOptions,
  trace,
  dataFrame,
  dataLinkPostProcessor,
  logsDataSourceSettings,
  traceDataSourceSettings,
}: {
  splitOpenFn: SplitOpen | undefined;
  traceToLogsOptions?: TraceToLogsOptionsV2;
  trace: Trace;
  dataFrame?: DataFrame;
  dataLinkPostProcessor?: DataLinkPostProcessor;
  logsDataSourceSettings?: DataSourceInstanceSettings<DataSourceJsonData>;
  traceDataSourceSettings?: DataSourceInstanceSettings<DataSourceJsonData>;
}): LinkModel | undefined {
  if (!logsDataSourceSettings || !traceToLogsOptions) {
    return undefined;
  }

  const { query, tags } = getTraceToLogsTraceQuery(trace, logsDataSourceSettings, traceToLogsOptions);
  if (!query) {
    return undefined;
  }

  const isSplunkDS = logsDataSourceSettings.type === 'grafana-splunk-datasource';
  const dataLink: DataLink = {
    title: logsDataSourceSettings.name,
    url: '',
    internal: {
      datasourceUid: logsDataSourceSettings.uid,
      datasourceName: logsDataSourceSettings.name,
      // If multiple queries are returned, use the first query to respect the interface.
      // LogsLink will then try to figure out which query to use and uppdate the link.
      // Otherwise, non-array, will use the legacy behavior.
      query: Array.isArray(query) ? query[0] : query,
      range: getTimeRangeFromTrace(
        trace,
        {
          startMs: traceToLogsOptions.spanStartTimeShift
            ? rangeUtil.intervalToMs(traceToLogsOptions.spanStartTimeShift)
            : 0,
          endMs: traceToLogsOptions.spanEndTimeShift ? rangeUtil.intervalToMs(traceToLogsOptions.spanEndTimeShift) : 0,
        },
        isSplunkDS
      ),
    },
  };

  const scopedVars: ScopedVars = {
    ...scopedVarsFromTrace(trace.duration, trace.traceName, trace.traceID),
    __tags: {
      text: t('explore.legacy-create-span-link-factory.text.tags', 'Tags'),
      value: tags,
    },
  };

  if (!getVariableUsageInfo(dataLink.internal!.query, scopedVars).allVariablesDefined) {
    return undefined;
  }

  const field: Field = {
    name: '',
    type: FieldType.other,
    config: {},
    values: [],
  };

  const replaceVariables = getTemplateSrv().replace.bind(getTemplateSrv());

  let link = mapInternalLinkToExplore({
    link: dataLink,
    internalLink: dataLink.internal!,
    scopedVars,
    range: dataLink.internal!.range,
    field,
    onClickFn: splitOpenFn,
    replaceVariables,
  });

  link =
    (dataFrame &&
      dataLinkPostProcessor?.({
        frame: dataFrame,
        field,
        dataLinkScopedVars: scopedVars,
        replaceVariables,
        config: {},
        link: dataLink,
        linkModel: link,
      })) ||
    link;

  if (Array.isArray(query)) {
    link.interpolatedParams = {
      ...link.interpolatedParams,
      alternativeQueries: interpolateQueries(query, scopedVars, replaceVariables).map((query) => ({
        ...query,
        datasource: { uid: logsDataSourceSettings.uid },
      })),
    };
  }

  return {
    ...link,
    title: getLogsButtonCTA(traceDataSourceSettings, 'trace'),
  };
}

/**
 * Gets a time range covering the whole trace.
 */
function getTimeRangeFromTrace(
  trace: Trace,
  timeShift: { startMs: number; endMs: number } = { startMs: 0, endMs: 0 },
  isSplunkDS = false
): TimeRange {
  return getTimeRangeFromTimestamps(trace.startTime, trace.duration, timeShift, isSplunkDS);
}

export function getTimeRangeFromTimestamps(
  startTimeUs: number,
  durationUs: number,
  timeShift: { startMs: number; endMs: number } = { startMs: 0, endMs: 0 },
  isSplunkDS = false,
  shouldCreatePyroscopeLink = false
): TimeRange {
  let adjustedStartTime = Math.floor(startTimeUs / 1000 + timeShift.startMs);
  const endMs = (startTimeUs + durationUs) / 1000;
  let adjustedEndTime = Math.floor(endMs + timeShift.endMs);

  // Splunk requires a time interval of >= 1s, rather than >=1ms like Loki timerange in below elseif block
  if (isSplunkDS && adjustedEndTime - adjustedStartTime < 1000) {
    adjustedEndTime = adjustedStartTime + 1000;
  } else if (shouldCreatePyroscopeLink) {
    adjustedStartTime = adjustedStartTime - 60000;
    adjustedEndTime = adjustedEndTime + 60000;
  } else if (adjustedStartTime >= adjustedEndTime) {
    // Because we can only pass milliseconds in the url we need to check if they are greater or equal.
    // We need end time to be later than start time
    adjustedEndTime = adjustedStartTime + 1;
  }

  const to = dateTime(adjustedEndTime);
  const from = dateTime(adjustedStartTime);

  // Beware that public/app/features/explore/state/main.ts SplitOpen fn uses the range from here. No matter what is in the url.
  return {
    from,
    to,
    raw: {
      from,
      to,
    },
  };
}

/**
 * Variables from trace that can be used in the query
 * @param trace
 */
export function scopedVarsFromTrace(duration: number, name: string, traceId: string): ScopedVars {
  return {
    __trace: {
      text: t('explore.scoped-vars-from-trace.text.trace', 'Trace'),
      value: {
        duration,
        name,
        traceId,
      },
    },
  };
}
