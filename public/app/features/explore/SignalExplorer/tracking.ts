import { reportInteraction } from '@grafana/runtime';

/**
 * Properties are snake_case, unlike Explore's older events, because these names are what Analytics
 * signed off on and built their dashboards against.
 *
 * No `user_id`: the RudderStack backend calls `identify()` once at init and forwards only these
 * properties to `track()`, so identity is already attached on their side.
 */
// A type rather than an interface, because `reportInteraction` takes a `Record<string, unknown>`
// and an interface has no implicit index signature to satisfy it with.
type SidebarContext = {
  /**
   * Which datasource the event belongs to, and it is not the same thing on every event: the three
   * card-level events report the card's own query datasource, always a concrete Prometheus flavor,
   * while `panel_opened` reports the pane's and so is the only one that can read `mixed`. Grouping
   * all four by this property in one query will not join up.
   */
  data_source_type?: string;
  /** One card per query, so stacking two queries on one datasource counts as two. */
  stacked_queries_count: number;
};

export function trackSignalExplorerPanelOpened(props: SidebarContext) {
  reportInteraction('signal_explorer_panel_opened', props);
}

export function trackSignalExplorerMetricExpanded(props: SidebarContext) {
  reportInteraction('signal_explorer_metric_expanded', props);
}

/**
 * The search term itself is deliberately absent: it can echo back label values from the user's own
 * data. Only its length and what it matched are reported.
 */
export function trackSignalExplorerSearchPerformed(
  props: SidebarContext & { search_term_length: number; result_count: number }
) {
  reportInteraction('signal_explorer_search_performed', props);
}

export function trackSignalExplorerMetricsMetadataViewed(props: SidebarContext) {
  reportInteraction('signal_explorer_metrics_metadata_viewed', props);
}
