import { RuleWithLocation } from 'app/types/unified-alerting';
import { RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { RuleFormType, RuleFormValues } from '../types/rule-form';
// TODO Ideally all of these should be moved here
import {
  DEFAULT_GROUP_EVALUATION_INTERVAL,
  getDefaultFormValues,
  getDefaultQueries,
  rulerRuleToFormValues,
} from '../utils/rule-form';

import {
  ignoreHiddenQueries,
  normalizeDefaultAnnotations,
  setInstantOrRange,
  setQueryEditorSettings,
} from './formProcessing';

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
      ignoreHiddenQueries({
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
  return ignoreHiddenQueries({
    ...getDefaultFormValues(),
    ...rule,
  });
}

export function formValuesFromExistingRule(rule: RuleWithLocation<RulerRuleDTO>) {
  return ignoreHiddenQueries(rulerRuleToFormValues(rule));
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
