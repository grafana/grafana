import { clamp } from 'lodash';
import * as z from 'zod/mini';

import { store } from '@grafana/data';
import { config } from '@grafana/runtime';
import { alertingAlertRuleFormSchema } from 'app/features/plugins/components/restrictedGrafanaApis/alerting/alertRuleFormSchema';
import { type RuleWithLocation } from 'app/types/unified-alerting';
import { GrafanaAlertStateDecision, type RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { shouldUseRulesAPIV2 } from '../featureToggles';
import { RuleFormType, type RuleFormValues } from '../types/rule-form';
// TODO Ideally all of these should be moved here
import { getRulesAccess } from '../utils/access-control';
import { GRAFANA_RULES_SOURCE_NAME, defaultAnnotations } from '../utils/constants';
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
const KEEP_FIRING_FOR_DEFAULT = '0s';

export const DEFAULT_GROUP_EVALUATION_INTERVAL = formatPrometheusDuration(
  clamp(GROUP_EVALUATION_MIN_INTERVAL_MS, GROUP_EVALUATION_INTERVAL_LOWER_BOUND, GROUP_EVALUATION_INTERVAL_UPPER_BOUND)
);

export const getDefaultFormValues = (ruleType?: RuleFormType): RuleFormValues => {
  const { canCreateGrafanaRules, canCreateCloudRules } = getRulesAccess();
  const type = (() => {
    if (ruleType === RuleFormType.grafanaRecording) {
      return RuleFormType.grafanaRecording;
    }
    if (canCreateGrafanaRules) {
      return RuleFormType.grafana;
    }
    if (canCreateCloudRules) {
      return RuleFormType.cloudAlerting;
    }
    return undefined;
  })();

  return Object.freeze({
    name: '',
    uid: '',
    labels: [{ key: '', value: '' }],
    annotations: defaultAnnotations,
    dataSourceName: GRAFANA_RULES_SOURCE_NAME, // let's use Grafana-managed alert rule by default
    type, // viewers can't create prom alerts
    group: '',
    // New Grafana rules default to ungrouped when the v2 API is enabled; flag-off keeps the legacy grouped flow.
    isUngroupedRuleGroup: shouldUseRulesAPIV2(),

    // grafana
    folder: undefined,
    queries: [],
    recordingRulesQueries: [],
    condition: '',
    noDataState: GrafanaAlertStateDecision.NoData,
    execErrState: GrafanaAlertStateDecision.Error,
    evaluateFor: DEFAULT_GROUP_EVALUATION_INTERVAL,
    keepFiringFor: KEEP_FIRING_FOR_DEFAULT,
    evaluateEvery: DEFAULT_GROUP_EVALUATION_INTERVAL,
    manualRouting: getDefautManualRouting(), // we default to true if the feature toggle is enabled and the user hasn't set local storage to false
    contactPoints: {},
    overrideGrouping: false,
    overrideTimings: false,
    muteTimeIntervals: [],
    editorSettings: getDefaultEditorSettings(ruleType),

    // cortex / loki
    namespace: '',
    expression: '',
    forTime: 1,
    forTimeUnit: 'm',
  });
};

export const getDefautManualRouting = () => {
  // check in local storage
  // if it's not set, we'll default to true
  const manualRouting = store.get(MANUAL_ROUTING_KEY);
  return manualRouting !== 'false';
};

function getDefaultEditorSettings(ruleType?: RuleFormType) {
  if (ruleType === RuleFormType.grafanaRecording) {
    return undefined;
  }

  //then, check in local storage if the user has saved last rule with sections simplified
  const queryEditorSettings = store.get(SIMPLIFIED_QUERY_EDITOR_KEY);
  const notificationStepSettings = store.get(MANUAL_ROUTING_KEY);
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
      ...getDefaultFormValues(type),
      queries: getDefaultQueries(),
    };
  }

  return setQueryEditorSettings(
    setInstantOrRange(
      revealHiddenQueries({
        ...getDefaultFormValues(type),
        ...ruleFromQueryParams,
        annotations: normalizeDefaultAnnotations(ruleFromQueryParams.annotations ?? []),
        queries: ruleFromQueryParams.queries ?? getDefaultQueries(),
        type: ruleFromQueryParams.type ?? type ?? RuleFormType.grafana,
        evaluateEvery: ruleFromQueryParams.evaluateEvery ?? DEFAULT_GROUP_EVALUATION_INTERVAL,
      })
    )
  );
}
// schema for cloud rule form values. This is necessary because the cloud rule form values are not the same as the grafana rule form values.
// schema for grafana rule values is navigateToAlertFormSchema , shared in the restrictedGrafanaApis.
// TODO: add this to the DMA new plugin.

const cloudRuleFormValuesSchema = z.looseObject({
  name: z.optional(z.string()),
  type: z.catch(z.enum(RuleFormType), RuleFormType.grafana),
  dataSourceName: z._default(z.string(), ''),
  group: z.optional(z.string()),
  labels: z._default(
    z.array(
      z.object({
        key: z.string(),
        value: z.string(),
      })
    ),
    []
  ),
  annotations: z._default(
    z.array(
      z.object({
        key: z.string(),
        value: z.string(),
      })
    ),
    []
  ),
  queries: z.optional(z.array(z.any())),
  condition: z.optional(z.string()),
  noDataState: z.catch(
    z._default(z.enum(GrafanaAlertStateDecision), GrafanaAlertStateDecision.NoData),
    GrafanaAlertStateDecision.NoData
  ),
  execErrState: z.catch(
    z._default(z.enum(GrafanaAlertStateDecision), GrafanaAlertStateDecision.Error),
    GrafanaAlertStateDecision.Error
  ),
  folder: z.optional(
    z.union([
      z.object({
        title: z.string(),
        uid: z.string(),
      }),
      z.undefined(),
    ])
  ),
  evaluateEvery: z.optional(z.string()),
  evaluateFor: z._default(z.string(), '0s'),
  keepFiringFor: z.optional(z.string()),
  isPaused: z._default(z.boolean(), false),
  manualRouting: z.optional(z.boolean()),
  contactPoints: z.optional(
    z.record(
      z.string(),
      z.object({
        selectedContactPoint: z.string(),
        overrideGrouping: z.boolean(),
        groupBy: z.array(z.string()),
        overrideTimings: z.boolean(),
        groupWaitValue: z.string(),
        groupIntervalValue: z.string(),
        repeatIntervalValue: z.string(),
        muteTimeIntervals: z.array(z.string()),
        activeTimeIntervals: z.array(z.string()),
      })
    )
  ),
  editorSettings: z.optional(
    z.object({
      simplifiedQueryEditor: z.boolean(),
      simplifiedNotificationEditor: z.boolean(),
    })
  ),
  metric: z.optional(z.string()),
  targetDatasourceUid: z.optional(z.string()),
  namespace: z.optional(z.string()),
  expression: z.optional(z.string()),
  missingSeriesEvalsToResolve: z.optional(z.number()),
});

export function formValuesFromPrefill(rule: Partial<RuleFormValues>): RuleFormValues {
  let parsedRule: z.infer<typeof alertingAlertRuleFormSchema> | z.infer<typeof cloudRuleFormValuesSchema>;
  // differencitate between cloud and grafana prefill
  if (rule.type === RuleFormType.cloudAlerting) {
    // we use this schema to coerce prefilled query params into a valid "FormValues" interface
    parsedRule = cloudRuleFormValuesSchema.parse(rule);
  } else {
    // grafana prefill
    // coerce prefill params to a valid RuleFormValues interface
    parsedRule = alertingAlertRuleFormSchema.parse(rule);
  }

  return setQueryEditorSettings(
    revealHiddenQueries({
      ...getDefaultFormValues(rule.type),
      ...parsedRule,
    })
  );
}

export function formValuesFromExistingRule(rule: RuleWithLocation<RulerRuleDTO>) {
  return revealHiddenQueries(rulerRuleToFormValues(rule));
}

export function defaultFormValuesForRuleType(ruleType: RuleFormType): RuleFormValues {
  return {
    ...getDefaultFormValues(ruleType),
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
