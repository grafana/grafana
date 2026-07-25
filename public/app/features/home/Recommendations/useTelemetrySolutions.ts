import { useAsync } from 'react-use';

import { useAppPluginMetas } from '@grafana/runtime/internal';

import { HOSTED_TRACES_APP_ID, LOGS_DRILLDOWN_APP_ID } from './appPluginIds';
import { buildLogsItem, buildTracesItem } from './buildTelemetryItems';
import { useSolutionState } from './solutionState';
import { fetchLogsActivity, fetchTracesActivity, fetchTracesServices } from './telemetryData';
import { type ExistingSolutionProviderResult } from './types';

export interface TelemetrySolutions {
  logs: ExistingSolutionProviderResult;
  traces: ExistingSolutionProviderResult;
}

/**
 * Logs and Traces solution providers: an entry appears only for a confirmed-active signal
 * ('unknown' never invents one) AND when its detail fetches produced something to show —
 * a bare title card with every stat failed-soft reads as broken, so it is dropped instead.
 */
export function useTelemetrySolutions(): TelemetrySolutions {
  const { value: resolution, loading: stateLoading } = useSolutionState();
  // Availability only picks link targets; a pending lookup falls back to /explore (never blocks).
  const { value: appMetas } = useAppPluginMetas();
  const availableApps = new Set((appMetas ?? []).map((app) => app.id));

  const lokiDs = resolution?.state.logs === 'active' ? resolution.lokiDatasource : null;
  const tempoDs = resolution?.state.traces === 'active' ? resolution.tempoDatasource : null;

  // Gate inside the callbacks (ds in the deps): an inactive or unknown signal never queries.
  const logsActivity = useAsync(async () => (lokiDs ? fetchLogsActivity(lokiDs) : undefined), [lokiDs]);
  const tracesActivity = useAsync(async () => (tempoDs ? fetchTracesActivity(tempoDs) : undefined), [tempoDs]);
  const tracesServices = useAsync(async () => (tempoDs ? fetchTracesServices(tempoDs) : undefined), [tempoDs]);

  let logs: ExistingSolutionProviderResult = { loading: stateLoading, item: null };
  if (lokiDs) {
    const activity = logsActivity.value;
    // Stats need bytes, the sparkline needs the series; with neither there is nothing to render.
    logs =
      logsActivity.loading || !activity
        ? { loading: logsActivity.loading, item: null }
        : activity.bytes == null && activity.series == null
          ? { loading: false, item: null }
          : {
              loading: false,
              item: buildLogsItem({
                bytes: activity.bytes,
                sources: activity.sources,
                volumeSeries: activity.series,
                datasourceName: lokiDs.name,
                drilldownAvailable: availableApps.has(LOGS_DRILLDOWN_APP_ID),
              }),
            };
  }

  let traces: ExistingSolutionProviderResult = { loading: stateLoading, item: null };
  if (tempoDs) {
    const activity = tracesActivity.value;
    // The services count alone renders nothing (it is the stats secondary), so it cannot carry a card.
    traces =
      tracesActivity.loading || tracesServices.loading || !activity
        ? { loading: tracesActivity.loading || tracesServices.loading, item: null }
        : activity.spans == null && activity.series == null
          ? { loading: false, item: null }
          : {
              loading: false,
              item: buildTracesItem({
                spans: activity.spans,
                services: tracesServices.value ?? null,
                throughputSeries: activity.series,
                datasourceName: tempoDs.name,
                drilldownAvailable: availableApps.has(HOSTED_TRACES_APP_ID),
              }),
            };
  }

  return { logs, traces };
}
