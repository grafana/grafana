import { reportInteraction } from '@grafana/runtime';

/**
 * Loaded the first time a dashboard containing Cloudmonitoring queries is loaded (not on every render)
 * Note: The queries used here are the ones pre-migration and pre-filterQuery
 */
export const trackCloudMonitoringDashboardLoaded = (props: CloudMonitoringDashboardLoadedProps) => {
  reportInteraction('grafana_ds_cloudmonitoring_dashboard_loaded', props);
};

export type CloudMonitoringDashboardLoadedProps = {
  grafana_version?: string;
  dashboard_id: string;
  org_id?: number;
  /** number of non hidden queries of type TimeSeriesQuery (MQL) if any  */
  mql_queries: number;
  /** number of non hidden queries of type TimeSeriesFilter (Builder) if any  */
  time_series_filter_queries: number;
  /** number of non hidden queries of type SLO if any  */
  slo_queries: number;
  /** number of non hidden queries of type annotation if any  */
  annotation_queries: number;
};
