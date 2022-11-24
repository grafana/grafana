import { DASHBOARDS } from "./constants";

export type DashboardType = keyof typeof DASHBOARDS;

/**
 * NOTE:
 * filters: filters enabled in the UI
 * implicitQueryPArams: hidden filters derived from the context
 */
export type DashboardConfig<D extends DashboardType = DashboardType> = {
  uuid: string;
  slug: string;
  name: string;
  /**
   * Explicit filters -> visible in the UI, can be applied by the user
   */
  filters: Array<MapDashboardTypeToDashboardFilters<D>>;
  /**
   * Hidden filters derived from the context
   */
  hiddenVariables: Array<MapDashboardTypeToDashboardFilters<D>>;
  /**
   * Filters passed to grafana in query-params (can be implicit or explicit)
   */
  queryParams: { [F in MapDashboardTypeToDashboardFilters<D>]?: string };
};

export type MapDashboardTypeToDashboardFilters<
  D extends DashboardType = DashboardType,
> = D extends "FLOW_ANALYTICS"
  ? FlowAnalyticsDashboardQueryParam
  : D extends "PROMETHEUS"
  ? PrometheusDashboardQueryParam
  : D extends "SIGNAL"
  ? SignalDashboardQueryParam
  : never;

export type ResourceType =
  | "FluxMeter"
  | "Classifier"
  | "ConcurrencyLimiter"
  | "RateLimiter"
  | "Signal";

export const FluxMeterResource: ResourceType = "FluxMeter";
export const ClassifierResource: ResourceType = "Classifier";
export const ConcurrencyLimiterResource: ResourceType = "ConcurrencyLimiter";
export const RateLimiterResource: ResourceType = "RateLimiter";
export const SignalResource: ResourceType = "Signal";

export type FlowAnalyticsDashboardFilter = typeof httpDashboardFilters[number];

export type PrometheusDashboardFilter =
  typeof prometheusDashboardFilters[number];

export type SignalDashboardFilter = typeof signalDashboardFilters[number];

export type FlowAnalyticsDashboardQueryParam =
  `var-${FlowAnalyticsDashboardFilter}`;
export type PrometheusDashboardQueryParam = `var-${PrometheusDashboardFilter}`;
export type SignalDashboardQueryParam = `var-${SignalDashboardFilter}`;

export type DashboardFilter =
  | FlowAnalyticsDashboardFilter
  | PrometheusDashboardQueryParam
  | SignalDashboardFilter;

export type DashboardQueryParam =
  | FlowAnalyticsDashboardQueryParam
  | PrometheusDashboardQueryParam
  | SignalDashboardQueryParam;

/**
 * NOTE:
 * 1. Based on *dashboards.libsonnet
 *
 * 2. fn_organization_id is read from token so we do not have to provide it.
 * We may have to hide it (list in implicit filters)
 */
export const httpDashboardFilters: string[] = [
  "fn_project_id",
  "controller_id",
  "agent_group",
  "services",
  "control_point",
  "concurrency_limiters",
  "workloads",
  "rate_limiters",
  "flux_meter_name",
  "classifiers",
  "fn_organization_id",
];

export const prometheusDashboardFilters: string[] = [
  "flux_meter_name",
  "fn_project_id",
];

export const signalDashboardFilters: string[] = ["policy_name", "signal_name"];

