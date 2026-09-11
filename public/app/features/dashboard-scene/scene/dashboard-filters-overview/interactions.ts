import { reportInteraction } from '@grafana/runtime';

const PREFIX = 'grafana_unified_drilldown_filters_overview_';

export function reportFiltersOverviewInteraction(event: string, properties?: Record<string, unknown>) {
  reportInteraction(`${PREFIX}${event}`, properties);
}
