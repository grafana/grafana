import { clamp } from 'lodash';

import { config } from '@grafana/runtime';
import { RuleWithLocation } from 'app/types/unified-alerting';
import { GrafanaAlertStateDecision, RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { RuleFormType, RuleFormValues } from '../types/rule-form';
// TODO Ideally all of these should be moved here
import { getRulesAccess } from '../utils/access-control';
import { defaultAnnotations } from '../utils/constants';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import {
  MANUAL_ROUTING_KEY,
  SIMPLIFIED_QUERY_EDITOR_KEY,
  getDefaultQueries,
  rulerRuleToFormValues,
} from '../utils/rule-form';
import { isGrafanaRecordingRuleByType } from '../utils/rules';
import { formatPrometheusDuration, safeParsePrometheusDuration } from '../utils/time';

import {
  normalizeDefaultAnnotations,
  revealHiddenQueries,
  setInstantOrRange,
  setQueryEditorSettings,
} from './formProcessing';

// even if the min interval is < 1m we should default to 1m, but allow arbitrary values for minInterval > 1m
const GROUP_EVALUATION_MIN_INTERVAL_MS = safeParsePrometheusDuration(config.unifiedAlerting?.minInterval ?? '10s');
const GROUP_EVALUATION_INTERVAL_LOWER_BOUND = safeParsePrometheusDuration('1m');
const GROUP_EVALUATION_INTERVAL_UPPER_BOUND = Infinity;

export const DEFAULT_GROUP_EVALUATION_INTERVAL = formatPrometheusDuration(
  clamp(GROUP_EVALUATION_MIN_INTERVAL_MS, GROUP_EVALUATION_INTERVAL_LOWER_BOUND, GROUP_EVALUATION_INTERVAL_UPPER_BOUND)
);
export const getDefaultFormValues = (): RuleFormValues => {
  const { canCreateGrafanaRules, canCreateCloudRules } = getRulesAccess();

  return Object.freeze({
    name: '',
    uid: '',
    labels: [{ key: '', value: '' }],
    annotations: defaultAnnotations,
    dataSourceName: GRAFANA_RULES_SOURCE_NAME, // let's use Grafana-managed alert rule by default
    type: canCreateGrafanaRules ? RuleFormType.grafana : canCreateCloudRules ? RuleFormType.cloudAlerting : undefined, // viewers can't create prom alerts
    group: '',

    // grafana
    folder: undefined,
    queries: [],
    recordingRulesQueries: [],
    condition: '',
    noDataState: GrafanaAlertStateDecision.NoData,
    execErrState: GrafanaAlertStateDecision.Error,
    evaluateFor: DEFAULT_GROUP_EVALUATION_INTERVAL,
    evaluateEvery: DEFAULT_GROUP_EVALUATION_INTERVAL,
    manualRouting: getDefautManualRouting(), // we default to true if the feature toggle is enabled and the user hasn't set local storage to false
    contactPoints: {},
    overrideGrouping: false,
    overrideTimings: false,
    muteTimeIntervals: [],
    editorSettings: getDefaultEditorSettings(),

    // cortex / loki
    namespace: '',
    expression: '',
    forTime: 1,
    forTimeUnit: 'm',
  });
};

export const getDefautManualRouting = () => {
  // first check if feature toggle for simplified routing is enabled
  const simplifiedRoutingToggleEnabled = config.featureToggles.alertingSimplifiedRouting ?? false;
  if (!simplifiedRoutingToggleEnabled) {
    return false;
  }
  //then, check in local storage if the user has enabled simplified routing
  // if it's not set, we'll default to true
  const manualRouting = localStorage.getItem(MANUAL_ROUTING_KEY);
  return manualRouting !== 'false';
};

function getDefaultEditorSettings() {
  const editorSettingsEnabled = config.featureToggles.alertingQueryAndExpressionsStepMode ?? false;
  if (!editorSettingsEnabled) {
    return undefined;
  }
  //then, check in local storage if the user has saved last rule with sections simplified
  const queryEditorSettings = localStorage.getItem(SIMPLIFIED_QUERY_EDITOR_KEY);
  const notificationStepSettings = localStorage.getItem(MANUAL_ROUTING_KEY);
  return {
    simplifiedQueryEditor: queryEditorSettings !== 'false',
    simplifiedNotificationEditor: notificationStepSettings !== 'false',
  };
}

export function formValuesFromQueryParams(ruleDefinition: string, type: RuleFormType): RuleFormValues {
  let ruleFromQueryParams: Partial<RuleFormValues>;

  try {
    ruleFromQueryParams = JSON.parse(ruleDefinition);
  } catch (err) {
    return {
      ...getDefaultFormValues(),
      queries: getDefaultQueries(),
    };
  }

  return setQueryEditorSettings(
    setInstantOrRange(
      revealHiddenQueries({
        ...getDefaultFormValues(),
        ...ruleFromQueryParams,
        annotations: normalizeDefaultAnnotations(ruleFromQueryParams.annotations ?? []),
        queries: ruleFromQueryParams.queries ?? getDefaultQueries(),
        type: type || RuleFormType.grafana,
        evaluateEvery: DEFAULT_GROUP_EVALUATION_INTERVAL,
      })
    )
  );
}

export function formValuesFromPrefill(rule: Partial<RuleFormValues>): RuleFormValues {
  return revealHiddenQueries({
    ...getDefaultFormValues(),
    ...rule,
  });
}

export function formValuesFromExistingRule(rule: RuleWithLocation<RulerRuleDTO>) {
  return revealHiddenQueries(rulerRuleToFormValues(rule));
}

export function defaultFormValuesForRuleType(ruleType: RuleFormType): RuleFormValues {
  return {
    ...getDefaultFormValues(),
    condition: 'C',
    queries: getDefaultQueries(isGrafanaRecordingRuleByType(ruleType)),
    type: ruleType,
    evaluateEvery: DEFAULT_GROUP_EVALUATION_INTERVAL,
  };
}

// TODO This function is not 100% valid. There is no support for cloud form type because
// it's not valid from the path param point of view.
export function translateRouteParamToRuleType(param = ''): RuleFormType {
  if (param === 'recording') {
    return RuleFormType.cloudRecording;
  }

  if (param === 'grafana-recording') {
    return RuleFormType.grafanaRecording;
  }

  return RuleFormType.grafana;
}
