import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { createAssistantContextItem, useAssistant } from '@grafana/assistant';
import { formatLabels } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Menu } from '@grafana/ui';
import { type GrafanaRule } from 'app/types/unified-alerting';

import { alertActivityEnabled } from '../../utils/pageAccess';
import { prometheusRuleType } from '../../utils/rules';

type AnalyzeRuleButtonProps =
  | { promRule: GrafanaRule; alertRule?: never; recordingRule?: never }
  | { alertRule: AlertRule; promRule?: never; recordingRule?: never }
  | { recordingRule: RecordingRule; promRule?: never; alertRule?: never };

/** API-neutral description of a rule, so prompt and context building doesn't depend on the source API. */
type RuleToAnalyze = AlertingRuleToAnalyze | RecordingRuleToAnalyze;

interface AlertingRuleToAnalyze {
  type: 'alerting';
  uid: string;
  title: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  query: string;
  state?: string;
  activeAt?: string;
}

interface RecordingRuleToAnalyze {
  type: 'recording';
  uid: string;
  title: string;
  labels?: Record<string, string>;
  query: string;
  metric?: string;
  targetDatasourceUID?: string;
}

/**
 * A menu item component that analyzes a rule.
 * Accepts either a Prometheus-shaped rule or an already loaded Kubernetes rule resource.
 * Automatically creates context from rule data and opens the assistant in assistant mode.
 */
export function AnalyzeRuleButton(props: AnalyzeRuleButtonProps) {
  const { isAvailable, openAssistant } = useAssistant();

  if (!isAvailable || !openAssistant) {
    return null;
  }

  const handleClick = () => {
    const rule = toRuleToAnalyze(props);
    if (!rule) {
      return;
    }

    openAssistant({
      origin: 'alerting/analyze-rule-menu-item',
      mode: 'assistant',
      prompt: buildAnalyzeRulePrompt(rule),
      context: [buildAnalyzeRuleContext(rule)],
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

function toRuleToAnalyze({ promRule, alertRule, recordingRule }: AnalyzeRuleButtonProps): RuleToAnalyze | undefined {
  if (promRule) {
    return fromPromRule(promRule);
  }
  if (alertRule) {
    return fromAlertRuleResource(alertRule);
  }
  if (recordingRule) {
    return fromRecordingRuleResource(recordingRule);
  }
  return undefined;
}

function fromPromRule(rule: GrafanaRule): RuleToAnalyze {
  if (prometheusRuleType.alertingRule(rule)) {
    return {
      type: 'alerting',
      uid: rule.uid,
      title: rule.name,
      labels: rule.labels,
      annotations: rule.annotations,
      query: rule.query,
      state: rule.state,
      activeAt: rule.activeAt,
    };
  }
  return { type: 'recording', uid: rule.uid, title: rule.name, labels: rule.labels, query: rule.query };
}

function fromAlertRuleResource(rule: AlertRule): RuleToAnalyze {
  return {
    type: 'alerting',
    uid: rule.metadata.name ?? '',
    title: rule.spec.title,
    labels: rule.spec.labels,
    annotations: rule.spec.annotations,
    query: JSON.stringify(rule.spec.expressions),
    state: rule.status?.state,
  };
}

function fromRecordingRuleResource(rule: RecordingRule): RuleToAnalyze {
  return {
    type: 'recording',
    uid: rule.metadata.name ?? '',
    title: rule.spec.title,
    labels: rule.spec.labels,
    query: JSON.stringify(rule.spec.expressions),
    metric: rule.spec.metric,
    targetDatasourceUID: rule.spec.targetDatasourceUID,
  };
}

function buildAnalyzeRuleContext(rule: RuleToAnalyze) {
  const titlePrefix = rule.type === 'alerting' ? 'Alert' : 'Recording rule';
  return createAssistantContextItem('structured', {
    title: `${titlePrefix}: ${rule.title}`,
    data: {
      rule: {
        name: rule.title,
        uid: rule.uid,
        labels: rule.labels,
        query: rule.query,
      },
    },
  });
}

/**
 * Builds a prompt for analyzing a rule (alerting or recording).
 */
function buildAnalyzeRulePrompt(rule: RuleToAnalyze): string {
  switch (rule.type) {
    case 'alerting':
      return buildAnalyzeAlertingRulePrompt(rule);
    case 'recording':
      return buildAnalyzeRecordingRulePrompt(rule);
  }
}

/**
 * Builds a prompt for analyzing an alerting rule.
 * Includes state, activeAt timestamp, annotations, and labels.
 */
function buildAnalyzeAlertingRulePrompt(rule: AlertingRuleToAnalyze): string {
  // Only mention a state when the source provides one, instead of assuming the rule is firing
  const state = rule.state ? ` ${rule.state.toLowerCase()}` : '';
  const timeInfo = rule.activeAt ? ` starting at ${new Date(rule.activeAt).toISOString()}` : '';
  const alertsNavigationPrompt = alertActivityEnabled()
    ? '\n- Include navigation to the alerts page ONLY if the alert is firing or pending'
    : '';

  let prompt = `
  Analyze the${state} alert "${rule.title} (uid: ${rule.uid})"${timeInfo}.
- Get the rule definition, read the queries and run them to understand the rule
- Get the rule state and instances to understand its current state
- Read the rule conditions and understand how it works. Then suggest query and conditions improvements if applicable${alertsNavigationPrompt}
  `;

  const description = rule.annotations?.description || rule.annotations?.summary || '';
  if (description) {
    prompt += ` ${description}`;
  }

  const labelsStr = formatLabels(rule.labels ?? {}, '', true);
  if (labelsStr) {
    prompt += ` Labels: ${labelsStr}.`;
  }

  return prompt;
}

/**
 * Builds a prompt for analyzing a recording rule.
 * Includes name, labels and the recorded metric (no state or activeAt).
 */
function buildAnalyzeRecordingRulePrompt(rule: RecordingRuleToAnalyze): string {
  let prompt = `Analyze the recording rule "${rule.title}".`;

  if (rule.metric) {
    prompt += ` Records metric: ${rule.metric}.`;
  }

  if (rule.targetDatasourceUID) {
    prompt += ` Target data source UID: ${rule.targetDatasourceUID}.`;
  }

  const labelsStr = formatLabels(rule.labels ?? {}, '', true);
  if (labelsStr) {
    prompt += ` Labels: ${labelsStr}.`;
  }

  return prompt;
}
