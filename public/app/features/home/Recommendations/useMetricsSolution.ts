import { useAsync } from 'react-use';

import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { canAccessPluginPage, usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';

import { buildMetricsItem } from './buildMetricsItem';
import { fetchMetricsHistory, fetchMetricsOverview, METRICS_DRILLDOWN_APP_ID } from './metricsData';
import { type ExistingSolutionProviderResult } from './types';

/**
 * Metrics solution provider: exposes the live metrics summary when the drilldown app is
 * ready and the selected datasource provides one.
 */
export function useMetricsSolution(): ExistingSolutionProviderResult {
  const { settings, installed, loading: settingsLoading } = usePluginBridge(METRICS_DRILLDOWN_APP_ID);
  const appReady =
    !settingsLoading &&
    !!installed &&
    !!settings &&
    canAccessPluginPage(settings, createBridgeURL(METRICS_DRILLDOWN_APP_ID, '/drilldown'));

  // Do not query until the drilldown app is ready; the overview result is the data gate.
  const {
    value: overview,
    error: overviewError,
    loading: overviewLoading,
  } = useAsync(async () => (appReady ? fetchMetricsOverview() : undefined), [appReady]);
  const { value: history, loading: historyLoading } = useAsync(
    () => (appReady && overview ? fetchMetricsHistory(overview) : Promise.resolve(null)),
    [appReady, overview]
  );

  if (!appReady || !settings) {
    return { loading: settingsLoading, item: null };
  }

  if (overviewError) {
    return { loading: false, item: null };
  }

  if (overviewLoading || overview === undefined) {
    return { loading: true, item: null };
  }

  return {
    loading: false,
    item: overview ? buildMetricsItem(overview, history ?? null, historyLoading) : null,
  };
}
