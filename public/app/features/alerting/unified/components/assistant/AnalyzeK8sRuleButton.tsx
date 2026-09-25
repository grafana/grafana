import { useMemo } from 'react';

import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { type OpenAssistantProps, createAssistantContextItem, useAssistant } from '@grafana/assistant';
import { t } from '@grafana/i18n';
import { Menu } from '@grafana/ui';

import { formatLabelsForPrompt } from './analyzeRulePromptUtils';

/**
 * Discriminated by `kind` rather than inferred from the resource, because `AlertRule` and
 * `RecordingRule` are structurally similar (both have `spec.title`, `spec.labels`,
 * `spec.expressions`) and a caller mixing them up should be a type error, not a runtime guess.
 */
export type AnalyzeK8sRuleProps = { kind: 'alert'; rule: AlertRule } | { kind: 'recording'; rule: RecordingRule };

/**
 * Kubernetes-resource entry point for the Assistant "Analyze rule" action. Accepts the already
 * loaded generated `AlertRule`/`RecordingRule` resource directly - callers must not adapt it into
 * (or otherwise manufacture) the legacy Prometheus-shaped `GrafanaRule` to reach this component.
 */
export function AnalyzeK8sRuleButton(props: AnalyzeK8sRuleProps) {
  const { isAvailable, openAssistant } = useAssistant();

  if (!isAvailable || !openAssistant) {
    return null;
  }

  return <AnalyzeK8sRuleButtonView {...props} openAssistant={openAssistant} />;
}

type ViewProps = AnalyzeK8sRuleProps & {
  openAssistant: (props: OpenAssistantProps) => void;
};

function AnalyzeK8sRuleButtonView(props: ViewProps) {
  const { openAssistant } = props;

  const ruleContext = useMemo(() => buildAssistantContext(props), [props]);
  const analyzeRulePrompt = useMemo(() => buildAnalyzeK8sRulePrompt(props), [props]);

  const handleClick = () => {
    openAssistant({
      origin: 'alerting/analyze-rule-menu-item',
      mode: 'assistant',
      prompt: analyzeRulePrompt,
      context: [ruleContext],
      autoSend: true,
    });
  };

  return (
    <Menu.Item
      label={t('alerting.alert-menu.analyze-rule', 'Analyze rule')}
      icon="ai-sparkle"
      onClick={handleClick}
      data-testid="analyze-rule-menu-item"
    />
  );
}

/**
 * Structured Assistant context built only from the rule's definition fields - status,
 * provenance, and other server metadata are deliberately excluded.
 */
function buildAssistantContext(props: AnalyzeK8sRuleProps) {
  const { rule } = props;
  const title = rule.spec.title;

  const baseFields = {
    name: rule.metadata.name,
    title,
    labels: rule.spec.labels,
    expressions: rule.spec.expressions,
  };

  const ruleData =
    props.kind === 'alert'
      ? { ...baseFields, annotations: props.rule.spec.annotations }
      : { ...baseFields, metric: props.rule.spec.metric, targetDatasourceUID: props.rule.spec.targetDatasourceUID };

  return createAssistantContextItem('structured', {
    title: `${props.kind === 'alert' ? 'Alert' : 'Recording'}: ${title}`,
    data: { rule: ruleData },
  });
}

/**
 * Builds a prompt for analyzing a rule (alerting or recording), from Kubernetes rule resources.
 */
function buildAnalyzeK8sRulePrompt(props: AnalyzeK8sRuleProps): string {
  return props.kind === 'alert' ? buildAnalyzeAlertRulePrompt(props.rule) : buildAnalyzeRecordingRulePrompt(props.rule);
}

/**
 * Runtime state is optional until the API reliably provides it - a missing `status.state` must
 * never be presented as `firing`, so we simply omit it from the prompt rather than default it.
 */
function buildAnalyzeAlertRulePrompt(rule: AlertRule): string {
  const { title } = rule.spec;
  const state = rule.status?.state;
  const stateInfo = state ? ` (currently ${state})` : '';

  let prompt = `
  Analyze the alert rule "${title} (uid: ${rule.metadata.name})"${stateInfo}.
- Get the rule definition, read the queries and run them to understand the rule
- Get the rule state and instances to understand its current state
- Read the rule conditions and understand how it works. Then suggest query and conditions improvements if applicable
  `;

  const description = rule.spec.annotations?.description || rule.spec.annotations?.summary || '';
  if (description) {
    prompt += ` ${description}`;
  }

  const labelsStr = formatLabelsForPrompt(rule.spec.labels);
  if (labelsStr) {
    prompt += ` Labels: ${labelsStr}.`;
  }

  return prompt;
}

/**
 * Recording rules have no alert state, instances, or notification routing - the prompt must not
 * imply any of those, and instead should describe the queries, recorded metric, and target
 * data source.
 */
function buildAnalyzeRecordingRulePrompt(rule: RecordingRule): string {
  const { title, metric, targetDatasourceUID } = rule.spec;

  let prompt = `Analyze the recording rule "${title} (uid: ${rule.metadata.name})", which records its query result as the metric "${metric}" on data source "${targetDatasourceUID}".`;

  const labelsStr = formatLabelsForPrompt(rule.spec.labels);
  if (labelsStr) {
    prompt += ` Labels: ${labelsStr}.`;
  }

  return prompt;
}
