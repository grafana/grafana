import { dateTime } from '@grafana/data';
import { faro, LogLevel as GrafanaLogLevel } from '@grafana/faro-web-sdk';
import { getBackendSrv } from '@grafana/runtime';
import { config, reportInteraction } from '@grafana/runtime/src';

export const USER_CREATION_MIN_DAYS = 15;

export const LogMessages = {
  filterByLabel: 'filtering alert instances by label',
  loadedList: 'loaded Alert Rules list',
  leavingRuleGroupEdit: 'leaving rule group edit without saving',
  alertRuleFromPanel: 'creating alert rule from panel',
  alertRuleFromScratch: 'creating alert rule from scratch',
  clickingAlertStateFilters: 'clicking alert state filters',
  cancelSavingAlertRule: 'user canceled alert rule creation',
  successSavingAlertRule: 'alert rule saved successfully',
  unknownMessageFromError: 'unknown messageFromError',
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

export async function isNewUser() {
  try {
    const { createdAt } = await getBackendSrv().get(`/api/user`);

    const limitDateForNewUser = dateTime().subtract(USER_CREATION_MIN_DAYS, 'days');
    const userCreationDate = dateTime(createdAt);

    const isNew = limitDateForNewUser.isBefore(userCreationDate);

    return isNew;
  } catch {
    return true; //if no date is returned, we assume the user is new to prevent tracking actions
  }
}

export const trackNewAlerRuleFormSaved = async (props: AlertRuleTrackingProps) => {
  const isNew = await isNewUser();
  if (isNew) {
    return;
  }
  reportInteraction('grafana_alerting_rule_creation', props);
};

export const trackNewAlerRuleFormCancelled = async (props: AlertRuleTrackingProps) => {
  const isNew = await isNewUser();
  if (isNew) {
    return;
  }
  reportInteraction('grafana_alerting_rule_aborted', props);
};

export const trackNewAlerRuleFormError = async (props: AlertRuleTrackingProps & { error: string }) => {
  const isNew = await isNewUser();
  if (isNew) {
    return;
  }
  reportInteraction('grafana_alerting_rule_form_error', props);
};

export type AlertRuleTrackingProps = {
  user_id: number;
  grafana_version?: string;
  org_id?: number;
};
