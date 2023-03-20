import { faro, LogLevel as GrafanaLogLevel } from '@grafana/faro-web-sdk';
import { config } from '@grafana/runtime/src';

export const LogMessages = {
  filterByLabel: 'filtering alert instances by label',
  loadedList: 'loaded Alert Rules list',
  leavingRuleGroupEdit: 'leaving rule group edit without saving',
  alertRuleFromPanel: 'creating alert rule from panel',
  alertRuleFromScratch: 'creating alert rule from scratch',
  clickingAlertStateFilters: 'clicking alert state filters',
  cancelSavingAlertRule: 'user canceled alert rule creation',
  successSavingAlertRule: 'alert rule saved successfully',
  filterPoliciesByMatchers: 'filtering notification policies by matchers',
};

// logInfo from '@grafana/runtime' should be used, but it doesn't handle Grafana JS Agent and Sentry correctly
export function logInfo(message: string, context: Record<string, string | number> = {}) {
  if (config.grafanaJavascriptAgent.enabled) {
    faro.api.pushLog([message], {
      level: GrafanaLogLevel.INFO,
      context: { ...context, module: 'Alerting' },
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withPerformanceLogging<TFunc extends (...args: any[]) => Promise<any>>(
  func: TFunc,
  message: string,
  context: Record<string, string>
): (...args: Parameters<TFunc>) => Promise<Awaited<ReturnType<TFunc>>> {
  return async function (...args) {
    const startLoadingTs = performance.now();
    const response = await func(...args);
    logInfo(message, {
      loadTimeMs: (performance.now() - startLoadingTs).toFixed(0),
      ...context,
    });

    return response;
  };
}
