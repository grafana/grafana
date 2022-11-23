import { 
    httpDashboardFilters, 
    prometheusDashboardFilters, 
    signalDashboardFilters, 
} from "./types";

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

export const DASHBOARDS = {
    FLOW_ANALYTICS: "flow-analytics",
    PROMETHEUS: "flux-meter",
    SIGNAL: "signal",
  };

  
export const HIDE_FILTERS_BY_DASHBOARD_TYPE = {
    FLOW_ANALYTICS: httpDashboardFilters,
    PROMETHEUS: prometheusDashboardFilters,
    SIGNAL: signalDashboardFilters,
};
