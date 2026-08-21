import { type DataSourceInstanceListItem } from '@grafana/data';

import { PROBE_TIMEOUT_MS } from './probeUtils';
import { readScalar, runInstantQueries } from './promQuery';
import { CLOUD_UTILITY_PROM_DATASOURCE_UIDS, probeFound, SPAN_METRICS_PROBE } from './solutionDataProbes';

async function prometheusHasSpanMetrics(ds: DataSourceInstanceListItem): Promise<boolean> {
  const frames = await runInstantQueries({ probe: SPAN_METRICS_PROBE }, ds, PROBE_TIMEOUT_MS);
  return (readScalar(frames, 'probe') ?? 0) > 0;
}

// App Observability has no homepage solution. The recommendation matrix uses this standalone probe,
// where per-datasource errors read as no span metrics.
export function probeSpanMetrics(): Promise<DataSourceInstanceListItem | null> {
  return probeFound('prometheus', prometheusHasSpanMetrics, CLOUD_UTILITY_PROM_DATASOURCE_UIDS);
}
