import { type UseFormClearErrors, type UseFormSetError } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { EvalFunction } from 'app/features/alerting/state/alertDef';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { ExpressionQueryType, reducerTypes, thresholdFunctions } from 'app/features/expressions/types';
import { type AlertQuery, type RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { getDefaultFormValues } from '../rule-editor/formDefaults';
import { type KVObject, RuleFormType, type RuleFormValues } from '../types/rule-form';

import { Annotation } from './constants';
import { isCloudAlertingRuleByType, isGrafanaAlertingRuleByType } from './rules';

export type RequiredAlertAnnotationField = 'summary' | 'description';

function isBlank(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

export function alertRuleRequiresAnnotations(values: RuleFormValues): boolean {
  return isGrafanaAlertingRuleByType(values.type) || isCloudAlertingRuleByType(values.type);
}

export function findAnnotationIndex(annotations: KVObject[], key: Annotation): number {
  return annotations.findIndex((annotation) => annotation.key === key);
}

export function getMissingRequiredAnnotationFields(values: RuleFormValues): RequiredAlertAnnotationField[] {
  if (!alertRuleRequiresAnnotations(values)) {
    return [];
  }

  const missing: RequiredAlertAnnotationField[] = [];
  if (isBlank(getAnnotationValue(values.annotations, Annotation.summary))) {
    missing.push('summary');
  }
  if (isBlank(getAnnotationValue(values.annotations, Annotation.description))) {
    missing.push('description');
  }
  return missing;
}

export function setRequiredAnnotationValidationErrors(
  values: RuleFormValues,
  setError: UseFormSetError<RuleFormValues>
): void {
  const summaryMessage = t(
    'alerting.annotations.validation.summary-required',
    'Summary is required. Enter a value or use Autofill.'
  );
  const descriptionMessage = t(
    'alerting.annotations.validation.description-required',
    'Description is required. Enter a value or use Autofill.'
  );

  for (const field of getMissingRequiredAnnotationFields(values)) {
    const key = field === 'summary' ? Annotation.summary : Annotation.description;
    const index = findAnnotationIndex(values.annotations, key);
    if (index === -1) {
      continue;
    }

    setError(`annotations.${index}.value`, {
      type: 'required',
      message: field === 'summary' ? summaryMessage : descriptionMessage,
    });
  }
}

export function clearRequiredAnnotationValidationErrors(
  annotations: KVObject[],
  clearErrors: UseFormClearErrors<RuleFormValues>
): void {
  for (const key of [Annotation.summary, Annotation.description]) {
    const index = findAnnotationIndex(annotations, key);
    if (index >= 0) {
      clearErrors(`annotations.${index}.value`);
    }
  }
}

export function validateRequiredAlertAnnotations(
  values: RuleFormValues,
  setError: UseFormSetError<RuleFormValues>
): boolean {
  const missing = getMissingRequiredAnnotationFields(values);
  if (missing.length === 0) {
    return true;
  }

  setRequiredAnnotationValidationErrors(values, setError);
  return false;
}

function getAnnotationValue(annotations: KVObject[], key: Annotation): string | undefined {
  return annotations.find((annotation) => annotation.key === key)?.value;
}

function withAnnotationValue(annotations: KVObject[], key: Annotation, value: string): KVObject[] {
  const existingIndex = annotations.findIndex((annotation) => annotation.key === key);
  if (existingIndex === -1) {
    return [...annotations, { key, value }];
  }

  return annotations.map((annotation, index) => (index === existingIndex ? { ...annotation, value } : annotation));
}

function getQueryExpressionText(query: AlertQuery): string | undefined {
  const model = query.model;

  if (
    model &&
    typeof model === 'object' &&
    'expr' in model &&
    typeof model.expr === 'string' &&
    model.expr.trim().length > 0
  ) {
    return model.expr.trim();
  }

  if (
    model &&
    typeof model === 'object' &&
    'query' in model &&
    typeof model.query === 'string' &&
    model.query.trim().length > 0
  ) {
    return model.query.trim();
  }

  if (
    model &&
    typeof model === 'object' &&
    'rawSql' in model &&
    typeof model.rawSql === 'string' &&
    model.rawSql.trim().length > 0
  ) {
    return model.rawSql.trim();
  }

  return undefined;
}

function formatEvaluator(evaluator?: { type?: EvalFunction; params?: number[] }): string {
  if (!evaluator?.type) {
    return 'meets the alert condition';
  }

  const evalLabel = thresholdFunctions.find((fn) => fn.value === evaluator.type)?.label?.toLowerCase() ?? 'meets';
  const params = evaluator.params ?? [];

  if (
    evaluator.type === EvalFunction.IsWithinRange ||
    evaluator.type === EvalFunction.IsOutsideRange ||
    evaluator.type === EvalFunction.IsWithinRangeIncluded ||
    evaluator.type === EvalFunction.IsOutsideRangeIncluded
  ) {
    return `${evalLabel} ${params[0]} and ${params[1]}`;
  }

  if (evaluator.type === EvalFunction.HasNoValue) {
    return evalLabel;
  }

  if (params[0] === undefined) {
    return evalLabel;
  }

  return `${evalLabel} ${params[0]}`;
}

function describeMonitoredQueries(values: RuleFormValues): string {
  const dataQueries = values.queries.filter((query) => !isExpressionQuery(query.model));

  if (dataQueries.length === 0) {
    return '';
  }

  return dataQueries
    .map((query) => {
      const expression = getQueryExpressionText(query);
      return expression ? `query ${query.refId}: ${expression}` : `query ${query.refId}`;
    })
    .join('; ');
}

function describeGrafanaAlertCondition(values: RuleFormValues): string {
  const { queries, condition } = values;
  if (!condition) {
    return 'the alert condition is met';
  }

  const conditionQuery = queries.find((query) => query.refId === condition);
  if (!conditionQuery || !isExpressionQuery(conditionQuery.model)) {
    return 'the alert condition is met';
  }

  if (conditionQuery.model.type === ExpressionQueryType.threshold) {
    const reduceQuery = queries.find((query) => query.refId === conditionQuery.model.expression);
    const reducer =
      reduceQuery && isExpressionQuery(reduceQuery.model) ? (reduceQuery.model.reducer ?? 'last') : 'last';
    const reducerLabel = reducerTypes.find((type) => type.value === reducer)?.text ?? `${reducer}()`;
    const evaluator = conditionQuery.model.conditions?.[0]?.evaluator;
    return `${reducerLabel} ${formatEvaluator(evaluator)}`;
  }

  if (conditionQuery.model.type === ExpressionQueryType.classic) {
    const classicCondition = conditionQuery.model.conditions?.[0];
    const reducer = classicCondition?.reducer?.type ?? 'last';
    const reducerLabel = reducerTypes.find((type) => type.value === reducer)?.text ?? `${reducer}()`;
    return `${reducerLabel} ${formatEvaluator(classicCondition?.evaluator)}`;
  }

  return 'the alert condition is met';
}

function generateGrafanaAlertSummary(values: RuleFormValues): string {
  const ruleName = values.name.trim() || 'Alert rule';
  const conditionText = describeGrafanaAlertCondition(values);
  return `${ruleName}: ${conditionText}`;
}

function generateGrafanaAlertDescription(values: RuleFormValues): string {
  const ruleName = values.name.trim() || 'Alert rule';
  const monitoredQueries = describeMonitoredQueries(values);
  const conditionText = describeGrafanaAlertCondition(values);
  const parts = [`Alert rule "${ruleName}" monitors ${monitoredQueries || 'configured queries'}.`];

  parts.push(`It fires when ${conditionText}.`);

  if (values.evaluateFor && values.evaluateFor !== '0s') {
    parts.push(`The condition must hold for ${values.evaluateFor} before firing.`);
  }

  if (values.evaluateEvery) {
    parts.push(`Evaluated every ${values.evaluateEvery}.`);
  }

  return parts.join(' ');
}

export function generateAlertDescriptionForGrafanaRule(rule: RulerGrafanaRuleDTO): string {
  const { grafana_alert: grafanaAlert, for: evaluateFor } = rule;
  const values: RuleFormValues = {
    ...getDefaultFormValues(RuleFormType.grafana),
    name: grafanaAlert.title,
    type: RuleFormType.grafana,
    condition: grafanaAlert.condition,
    queries: grafanaAlert.data,
    evaluateFor: evaluateFor ?? '0',
    evaluateEvery: grafanaAlert.intervalSeconds ? `${grafanaAlert.intervalSeconds}s` : '1m',
    group: grafanaAlert.rule_group,
    folder: { title: '', uid: grafanaAlert.namespace_uid },
    isPaused: Boolean(grafanaAlert.is_paused),
    noDataState: grafanaAlert.no_data_state ?? getDefaultFormValues(RuleFormType.grafana).noDataState,
    execErrState: grafanaAlert.exec_err_state ?? getDefaultFormValues(RuleFormType.grafana).execErrState,
    keepFiringFor: rule.keep_firing_for ?? '0',
  };

  return generateGrafanaAlertDescription(values);
}

function generateCloudAlertSummary(values: RuleFormValues): string {
  const ruleName = values.name.trim() || 'Alert rule';
  const expression = values.expression?.trim();
  if (expression) {
    return `${ruleName}: ${expression}`;
  }
  return `${ruleName}: alert condition is met`;
}

function generateCloudAlertDescription(values: RuleFormValues): string {
  const ruleName = values.name.trim() || 'Alert rule';
  const expression = values.expression?.trim();
  const parts = [`Alert rule "${ruleName}"`];

  if (expression) {
    parts[0] += ` evaluates the expression: ${expression}.`;
  } else {
    parts[0] += ' evaluates a configured expression.';
  }

  if (values.forTime && values.forTimeUnit) {
    parts.push(`The condition must hold for ${values.forTime}${values.forTimeUnit} before firing.`);
  }

  return parts.join(' ');
}

/**
 * Fills in summary and description annotations when they are missing from alert rule form values.
 * Recording rules are returned unchanged.
 */
export function ensureAlertAnnotations(values: RuleFormValues): RuleFormValues {
  const isGrafanaAlert = isGrafanaAlertingRuleByType(values.type);
  const isCloudAlert = isCloudAlertingRuleByType(values.type);

  if (!isGrafanaAlert && !isCloudAlert) {
    return values;
  }

  let annotations = values.annotations;
  const summary = getAnnotationValue(annotations, Annotation.summary);
  const description = getAnnotationValue(annotations, Annotation.description);

  if (isBlank(summary)) {
    const generatedSummary = isGrafanaAlert ? generateGrafanaAlertSummary(values) : generateCloudAlertSummary(values);
    annotations = withAnnotationValue(annotations, Annotation.summary, generatedSummary);
  }

  if (isBlank(description)) {
    const generatedDescription = isGrafanaAlert
      ? generateGrafanaAlertDescription(values)
      : generateCloudAlertDescription(values);
    annotations = withAnnotationValue(annotations, Annotation.description, generatedDescription);
  }

  if (annotations === values.annotations) {
    return values;
  }

  return { ...values, annotations };
}
