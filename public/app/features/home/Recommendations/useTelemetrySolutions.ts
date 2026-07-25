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
 * ('unknown' never invents one), filled with live stats from the datasource that won the probe.
 * Detail fetches fail soft: the entry renders without the failed stat or sparkline.
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

  const logs: ExistingSolutionProviderResult = lokiDs
    ? {
        loading: false,
        item: buildLogsItem({
          bytes: logsActivity.value?.bytes,
          sources: logsActivity.value?.sources,
          volumeSeries: logsActivity.value?.series ?? null,
          activityLoading: logsActivity.loading,
          datasourceName: lokiDs.name,
          drilldownAvailable: availableApps.has(LOGS_DRILLDOWN_APP_ID),
        }),
      }
    : { loading: stateLoading, item: null };

  const traces: ExistingSolutionProviderResult = tempoDs
    ? {
        loading: false,
        item: buildTracesItem({
          spans: tracesActivity.value?.spans,
          services: tracesServices.value,
          activityLoading: tracesActivity.loading,
          throughputSeries: tracesActivity.value?.series ?? null,
          datasourceName: tempoDs.name,
          drilldownAvailable: availableApps.has(HOSTED_TRACES_APP_ID),
        }),
      }
    : { loading: stateLoading, item: null };

  return { logs, traces };
}
