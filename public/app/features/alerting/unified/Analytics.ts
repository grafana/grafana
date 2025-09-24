import { pickBy } from 'lodash';

import { config, createMonitoringLogger, reportInteraction } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';

import { RuleNamespace } from '../../../types/unified-alerting';
import { RulerRulesConfigDTO } from '../../../types/unified-alerting-dto';

import { Origin } from './components/rule-viewer/tabs/version-history/ConfirmVersionRestoreModal';
import { FilterType } from './components/rules/central-state-history/EventListSceneObject';
import { AdvancedFilters } from './rule-list/filter/types';
import { RulesFilter } from './search/rulesSearchParser';
import { RuleFormType } from './types/rule-form';

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
  grafanaRecording: 'creating Grafana recording rule from scratch',
  loadedCentralAlertStateHistory: 'loaded central alert state history',
  exportNewGrafanaRule: 'exporting new Grafana rule',
  noAlertRuleVersionsFound: 'no alert rule versions found',
};

const { logInfo, logError, logMeasurement, logWarning } = createMonitoringLogger('features.alerting', {
  module: 'Alerting',
});

export { logError, logInfo, logMeasurement, logWarning };

/**
 * Utility function to measure performance of async operations
 * @param func Function to measure
 * @param measurementName Name of the measurement for logging
 * @param context Context for logging
 */
export function withPerformanceLogging<TArgs extends unknown[], TReturn>(
  func: (...args: TArgs) => Promise<TReturn>,
  measurementName: string,
  context: Record<string, string> = {}
): (...args: TArgs) => Promise<TReturn> {
  return async function (...args: TArgs): Promise<TReturn> {
    const startMark = `${measurementName}:start`;
    performance.mark(startMark);

    const response = await func(...args);

    const loadTimeMeasure = performance.measure(measurementName, startMark);
    logMeasurement(
      measurementName,
      { duration: loadTimeMeasure.duration, loadTimesMs: loadTimeMeasure.duration },
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

type FormErrors = Record<string, Partial<{ message: string; type: string | number }>>;
export function reportFormErrors(errors: FormErrors) {
  Object.entries(errors).forEach(([field, error]) => {
    const message = error.message ?? 'unknown error';
    const type = String(error.type) ?? 'unknown';

    const errorObject = new Error(message);

    logError(errorObject, { field, type });
  });
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

export const trackRuleListNavigation = async (
  props: AlertRuleTrackingProps = {
    grafana_version: config.buildInfo.version,
    org_id: contextSrv.user.orgId,
    user_id: contextSrv.user.id,
  }
) => {
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

export const trackNewGrafanaAlertRuleFormSavedSuccess = (payload: {
  simplifiedQueryEditor: boolean;
  simplifiedNotificationEditor: boolean;
  canBeTransformedToSimpleQuery: boolean;
}) => {
  reportInteraction('grafana_alerting_grafana_rule_creation_new_success', payload);
};

export const trackNewGrafanaAlertRuleFormCancelled = () => {
  reportInteraction('grafana_alerting_grafana_rule_creation_new_aborted');
};

export const trackNewGrafanaAlertRuleFormError = () => {
  reportInteraction('grafana_alerting_grafana_rule_creation_new_error');
};

export const trackInsightsFeedback = async (props: { useful: boolean; panel: string }) => {
  const defaults = {
    grafana_version: config.buildInfo.version,
    org_id: contextSrv.user.orgId,
    user_id: contextSrv.user.id,
  };
  reportInteraction('grafana_alerting_insights', { ...defaults, ...props });
};

interface RuleVersionComparisonProps {
  latest: boolean;
  oldVersion: number;
  newVersion: number;
}

export const trackRuleVersionsComparisonClick = async (payload: RuleVersionComparisonProps) => {
  reportInteraction('grafana_alerting_rule_versions_comparison_click', { ...payload });
};

export const trackRuleVersionsRestoreSuccess = async (payload: RuleVersionComparisonProps & { origin: Origin }) => {
  reportInteraction('grafana_alerting_rule_versions_restore_success', { ...payload });
};

export const trackRuleVersionsRestoreFail = async (
  payload: RuleVersionComparisonProps & { origin: Origin; error: Error }
) => {
  reportInteraction('grafana_alerting_rule_versions_restore_error', { ...payload });
};

export const trackDeletedRuleRestoreSuccess = async () => {
  reportInteraction('grafana_alerting_deleted_rule_restore_success');
};

export const trackDeletedRuleRestoreFail = async () => {
  reportInteraction('grafana_alerting_deleted_rule_restore_error');
};

export const trackImportToGMASuccess = async (payload: {
  importSource: 'yaml' | 'datasource';
  isRootFolder: boolean;
  namespace?: string;
  ruleGroup?: string;
  pauseRecordingRules: boolean;
  pauseAlertingRules: boolean;
}) => {
  reportInteraction('grafana_alerting_import_to_gma_success', { ...payload });
};

export const trackImportToGMAError = async (payload: { importSource: 'yaml' | 'datasource' }) => {
  reportInteraction('grafana_alerting_import_to_gma_error', { ...payload });
};

export function trackRulesListViewChange(payload: { view: string }) {
  reportInteraction('grafana_alerting_rules_list_mode', { ...payload });
}
export function trackEditInputWithTemplate() {
  reportInteraction('grafana_alerting_contact_point_form_edit_input_with_template');
}
export function trackUseCustomInputInTemplate() {
  reportInteraction('grafana_alerting_contact_point_form_use_custom_input_in_template');
}
export function trackUseSingleTemplateInInput() {
  reportInteraction('grafana_alerting_contact_point_form_use_single_template_in_input');
}
export function trackUseCentralHistoryFilterByClicking(payload: { type: FilterType; key: string; value: string }) {
  reportInteraction('grafana_alerting_central_alert_state_history_filter_by_clicking', payload);
}

export function trackUseCentralHistoryExpandRow() {
  reportInteraction('grafana_alerting_central_alert_state_history_expand_row');
}

export function trackUseCentralHistoryMaxEventsReached(payload: { from: number; to: number }) {
  reportInteraction('grafana_alerting_central_alert_state_history_max_events_reached', payload);
}

export function trackFolderBulkActionsDeleteSuccess() {
  reportInteraction('grafana_alerting_folder_bulk_actions_delete_success');
}

export function trackFolderBulkActionsDeleteFail() {
  reportInteraction('grafana_alerting_folder_bulk_actions_delete_fail');
}

export function trackFolderBulkActionsPauseSuccess() {
  reportInteraction('grafana_alerting_folder_bulk_actions_pause_success');
}

export function trackFolderBulkActionsUnpauseSuccess() {
  reportInteraction('grafana_alerting_folder_bulk_actions_unpause_success');
}

export function trackFolderBulkActionsPauseFail() {
  reportInteraction('grafana_alerting_folder_bulk_actions_pause_fail');
}

export function trackFolderBulkActionsUnpauseFail() {
  reportInteraction('grafana_alerting_folder_bulk_actions_unpause_fail');
}

export function trackFilterButtonClick() {
  reportInteraction('grafana_alerting_filter_button_click');
}

export function trackAlertRuleFilterEvent(
  payload:
    | { filterMethod: 'search-input'; filter: RulesFilter; filterVariant: 'v1' | 'v2' }
    | { filterMethod: 'filter-component'; filter: keyof RulesFilter; filterVariant: 'v1' | 'v2' }
) {
  const variant = payload.filterVariant;
  if (payload.filterMethod === 'search-input') {
    const meaningfulValues = filterMeaningfulValues(payload.filter);
    reportInteraction('grafana_alerting_rules_filter', {
      ...meaningfulValues,
      filter_method: 'search-input',
      filter_variant: variant,
    });
    return;
  }
  reportInteraction('grafana_alerting_rules_filter', {
    filter: payload.filter,
    filter_method: 'filter-component',
    filter_variant: variant,
  });
}

export function trackRulesSearchInputCleared(prev: string, next: string) {
  // Only report an explicit clear action when transitioning from non-empty to empty
  if (prev !== '' && next === '') {
    reportInteraction('grafana_alerting_rules_filter_cleared', { filter_method: 'search-input' });
  }
}

export function trackFilterButtonApplyClick(payload: AdvancedFilters, pluginsFilterEnabled: boolean) {
  // Filter out empty/default values before tracking
  const meaningfulValues = filterMeaningfulValues(payload, { pluginsFilterEnabled });

  reportInteraction('grafana_alerting_rules_filter', {
    ...meaningfulValues,
    filter_method: 'filter-component',
    filter_variant: 'v2',
  });
}

function filterMeaningfulValues(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: Record<string, any>,
  opts?: { pluginsFilterEnabled?: boolean }
) {
  const { pluginsFilterEnabled = true } = opts ?? {};
  return pickBy(obj, (value, key) => {
    if (value === null || value === undefined || value === '') {
      return false;
    }
    if (Array.isArray(value) && value.length === 0) {
      return false;
    }
    if (value === '*') {
      return false;
    }
    if (key === 'plugins' && !pluginsFilterEnabled) {
      return false;
    }
    if (key === 'plugins' && value === 'show') {
      return false;
    }
    return true;
  });
}

export function trackFilterButtonClearClick() {
  reportInteraction('grafana_alerting_rules_filter_cleared', {
    filter_method: 'filter-component',
  });
}

export type AlertRuleTrackingProps = {
  user_id: number;
  grafana_version?: string;
  org_id?: number;
};
