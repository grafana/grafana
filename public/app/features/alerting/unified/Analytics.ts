import { isEmpty } from 'lodash';

import { dateTime } from '@grafana/data';
import { createMonitoringLogger, getBackendSrv } from '@grafana/runtime';
import { config, reportInteraction } from '@grafana/runtime/src';
import { contextSrv } from 'app/core/core';

import { RuleNamespace } from '../../../types/unified-alerting';
import { RulerRulesConfigDTO } from '../../../types/unified-alerting-dto';

import { getSearchFilterFromQuery, RulesFilter } from './search/rulesSearchParser';
import { RuleFormType } from './types/rule-form';

export const USER_CREATION_MIN_DAYS = 7;

export const LogMessages = {
  filterByLabel: 'filtering alert instances by label',
  loadedList: 'loaded Alert Rules list',
  leavingRuleGroupEdit: 'leaving rule group edit without saving',
  alertRuleFromPanel: 'creating alert rule from panel',
  alertRuleFromScratch: 'creating alert rule from scratch',
  recordingRuleFromScratch: 'creating recording rule from scratch',
  clickingAlertStateFilters: 'clicking alert state filters',
  cancelSavingAlertRule: 'user canceled alert rule creation',
  successSavingAlertRule: 'alert rule saved successfully',
  unknownMessageFromError: 'unknown messageFromError',
};

const { logInfo, logError, logMeasurement } = createMonitoringLogger('features.alerting', { module: 'Alerting' });

export { logInfo, logError, logMeasurement };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withPerformanceLogging<TFunc extends (...args: any[]) => Promise<any>>(
  type: string,
  func: TFunc,
  context: Record<string, string>
): (...args: Parameters<TFunc>) => Promise<Awaited<ReturnType<TFunc>>> {
  return async function (...args) {
    const startLoadingTs = performance.now();

    const response = await func(...args);
    const loadTimesMs = performance.now() - startLoadingTs;

    logMeasurement(
      type,
      {
        loadTimesMs,
      },
      context
    );

    return response;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withPromRulesMetadataLogging<TFunc extends (...args: any[]) => Promise<RuleNamespace[]>>(
  type: string,
  func: TFunc,
  context: Record<string, string>
) {
  return async (...args: Parameters<TFunc>) => {
    const startLoadingTs = performance.now();
    const response = await func(...args);

    const { namespacesCount, groupsCount, rulesCount } = getPromRulesMetadata(response);

    logMeasurement(
      type,
      {
        loadTimeMs: performance.now() - startLoadingTs,
        namespacesCount,
        groupsCount,
        rulesCount,
      },
      context
    );
    return response;
  };
}

function getPromRulesMetadata(promRules: RuleNamespace[]) {
  const namespacesCount = promRules.length;
  const groupsCount = promRules.flatMap((ns) => ns.groups).length;
  const rulesCount = promRules.flatMap((ns) => ns.groups).flatMap((g) => g.rules).length;

  const metadata = {
    namespacesCount: namespacesCount,
    groupsCount: groupsCount,
    rulesCount: rulesCount,
  };

  return metadata;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withRulerRulesMetadataLogging<TFunc extends (...args: any[]) => Promise<RulerRulesConfigDTO>>(
  type: string,
  func: TFunc,
  context: Record<string, string>
) {
  return async (...args: Parameters<TFunc>) => {
    const startLoadingTs = performance.now();
    const response = await func(...args);

    const { namespacesCount, groupsCount, rulesCount } = getRulerRulesMetadata(response);

    logMeasurement(
      type,
      {
        namespacesCount,
        groupsCount,
        rulesCount,
        loadTimeMs: performance.now() - startLoadingTs,
      },
      context
    );
    return response;
  };
}

function getRulerRulesMetadata(rulerRules: RulerRulesConfigDTO) {
  const namespaces = Object.keys(rulerRules);
  const groups = Object.values(rulerRules).flatMap((groups) => groups);
  const rules = groups.flatMap((group) => group.rules);

  return {
    namespacesCount: namespaces.length,
    groupsCount: groups.length,
    rulesCount: rules.length,
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

export const trackRuleListNavigation = async (
  props: AlertRuleTrackingProps = {
    grafana_version: config.buildInfo.version,
    org_id: contextSrv.user.orgId,
    user_id: contextSrv.user.id,
  }
) => {
  const isNew = await isNewUser();
  if (isNew) {
    return;
  }
  reportInteraction('grafana_alerting_navigation', props);
};

export const trackAlertRuleFormSaved = (props: { formAction: 'create' | 'update'; ruleType?: RuleFormType }) => {
  reportInteraction('grafana_alerting_rule_creation', props);
};

export const trackAlertRuleFormCancelled = (props: { formAction: 'create' | 'update' }) => {
  reportInteraction('grafana_alerting_rule_aborted', props);
};

export const trackAlertRuleFormError = (
  props: AlertRuleTrackingProps & { error: string; formAction: 'create' | 'update' }
) => {
  reportInteraction('grafana_alerting_rule_form_error', props);
};

export const trackInsightsFeedback = async (props: { useful: boolean; panel: string }) => {
  const defaults = {
    grafana_version: config.buildInfo.version,
    org_id: contextSrv.user.orgId,
    user_id: contextSrv.user.id,
  };
  reportInteraction('grafana_alerting_insights', { ...defaults, ...props });
};

interface RulesSearchInteractionPayload {
  filter: string;
  triggeredBy: 'typing' | 'component';
}

function trackRulesSearchInteraction(payload: RulesSearchInteractionPayload) {
  reportInteraction('grafana_alerting_rules_search', { ...payload });
}

export function trackRulesSearchInputInteraction({ oldQuery, newQuery }: { oldQuery: string; newQuery: string }) {
  try {
    const oldFilter = getSearchFilterFromQuery(oldQuery);
    const newFilter = getSearchFilterFromQuery(newQuery);

    const oldFilterTerms = extractFilterKeys(oldFilter);
    const newFilterTerms = extractFilterKeys(newFilter);

    const newTerms = newFilterTerms.filter((term) => !oldFilterTerms.includes(term));
    newTerms.forEach((term) => {
      trackRulesSearchInteraction({ filter: term, triggeredBy: 'typing' });
    });
  } catch (e: unknown) {
    if (e instanceof Error) {
      logError(e);
    }
  }
}

function extractFilterKeys(filter: RulesFilter) {
  return Object.entries(filter)
    .filter(([_, value]) => !isEmpty(value))
    .map(([key]) => key);
}

export function trackRulesSearchComponentInteraction(filter: keyof RulesFilter) {
  trackRulesSearchInteraction({ filter, triggeredBy: 'component' });
}

export function trackRulesListViewChange(payload: { view: string }) {
  reportInteraction('grafana_alerting_rules_list_mode', { ...payload });
}

export type AlertRuleTrackingProps = {
  user_id: number;
  grafana_version?: string;
  org_id?: number;
};
