/**
 * Request and response bodies of Grafana's Prometheus convert API (`/api/convert/...`), which turns
 * Prometheus-compatible rule groups and Alertmanager configs (as mimirtool and cortextool send them)
 * into Grafana-managed resources.
 *
 * The rule types are the Ruler API shapes, as Prometheus, Mimir and Cortex use them.
 */

export interface RulerRecordingRuleDTO {
  record: string;
  expr: string;
  labels?: Record<string, string>;
}

export interface RulerAlertingRuleDTO {
  alert: string;
  expr: string;
  for?: string;
  keep_firing_for?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

/** Ruler rules have no `type` field; an alerting rule has `alert` and a recording rule has `record`. */
export type RulerRuleDTO = RulerAlertingRuleDTO | RulerRecordingRuleDTO;

/**
 * A rule group as the Ruler API returns it.
 *
 * The convert API reads `name`, `interval`, `limit`, `query_offset`, `labels` and `rules`. It drops the
 * Mimir-only fields (`evaluation_delay`, `source_tenants`, `align_evaluation_time_on_interval`) without an
 * error, so a federated Mimir group is imported as a plain one.
 */
export interface RulerRuleGroupDTO {
  name: string;
  interval?: string;
  /** Maximum number of alerts or series a single rule in this group may produce. */
  limit?: number;
  /** How far back to shift the evaluation query, e.g. to wait for late samples. */
  query_offset?: string;
  /** Labels added to every rule in the group. */
  labels?: Record<string, string>;
  /** Mimir's older name for `query_offset`. */
  evaluation_delay?: string;
  /** Mimir: tenants whose data this group's rules read. */
  source_tenants?: string[];
  /** Mimir: evaluate on interval boundaries rather than at an arbitrary offset. */
  align_evaluation_time_on_interval?: boolean;
  rules: RulerRuleDTO[];
}

/** Rule groups keyed by namespace. A namespace is a folder title on the Grafana side. */
export type RulerRulesConfigDTO = Record<string, RulerRuleGroupDTO[]>;

// Overrides for how alerts sent straight to a contact point are grouped and timed.
interface RoutingOverridesDTO {
  group_by?: string[];
  group_wait?: string;
  group_interval?: string;
  repeat_interval?: string;
  mute_time_intervals?: string[];
  active_time_intervals?: string[];
}

/** Send straight to a contact point, optionally with grouping, timing and time interval overrides. */
export type RulerContactPointRoutingDTO = RoutingOverridesDTO & { receiver: string; policy?: undefined };

// A policy carries no overrides. They're listed as `undefined` so code can read them without first checking
// which kind of settings it has.
type NoRoutingOverrides = { [Key in keyof RoutingOverridesDTO]?: undefined };

/**
 * Route through a named notification policy tree. Grafana's ruler API also sends `receiver: ''` with it,
 * since its `receiver` field is always written out.
 */
export interface RulerPolicyRoutingDTO extends NoRoutingOverrides {
  policy: string;
  receiver?: '';
}

/**
 * Notification settings in the shape the Ruler API uses (`AlertRuleNotificationSettings` in Grafana's
 * `cortex-ruler.go`). The convert API takes it JSON-encoded in the `X-Grafana-Alerting-Notification-Settings`
 * header, and Grafana's own ruler API returns it as `notification_settings` on each rule.
 *
 * Exactly one of `receiver` (a contact point) or `policy` (a named routing tree) is set.
 */
export type RulerNotificationSettingsDTO = RulerContactPointRoutingDTO | RulerPolicyRoutingDTO;

export interface ConvertPrometheusResponse {
  status: string;
  errorType: string;
  error: string;
}

/** Resources an Alertmanager import renamed so they don't clash with existing ones, old name to new name. */
export interface RenameResources {
  receivers?: Record<string, string>;
  time_intervals?: Record<string, string>;
}

/** What an Alertmanager import added to the config. Names are after any rename. */
export interface MergeStats {
  /** The routing tree the import added. */
  added_route?: string;
  added_receivers?: string[];
  added_time_intervals?: string[];
  added_templates?: string[];
  added_inhibition_rules?: string[];
}

export interface ConvertAlertmanagerResponse extends ConvertPrometheusResponse {
  rename_resources?: RenameResources;
  stats?: MergeStats;
}

/** An Alertmanager config as mimirtool sends it: the config itself as a YAML string, and its template files. */
export interface AlertmanagerUserConfig {
  alertmanager_config: string;
  template_files: Record<string, string>;
}
