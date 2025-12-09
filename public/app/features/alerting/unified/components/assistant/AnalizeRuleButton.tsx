import { useMemo } from 'react';

import { OpenAssistantProps, createAssistantContextItem, useAssistant } from '@grafana/assistant';
import { t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Menu } from '@grafana/ui';
import { GrafanaAlertingRule, GrafanaRecordingRule, GrafanaRule } from 'app/types/unified-alerting';

import { prometheusRuleType } from '../../utils/rules';

interface AnalyzeRuleButtonProps {
  /** Alert rule to analyze */
  rule: GrafanaRule;
}

/**
 * A menu item component that analyze an alert rule.
 * Automatically creates context from alert data and opens the assistant in assistant mode.
 */
export function AnalyzeRuleButton(props: AnalyzeRuleButtonProps) {
  const { isAvailable, openAssistant } = useAssistant();

  if (!isAvailable || !openAssistant) {
    return null;
  }

  return <AnalyzeRuleButtonView {...props} openAssistant={openAssistant} />;
}

function AnalyzeRuleButtonView({
  rule,
  openAssistant,
}: AnalyzeRuleButtonProps & {
  openAssistant: (props: OpenAssistantProps) => void;
}) {
  // Create alert rule context from alert rule data
  const alertContext = useMemo(() => {
    return createAssistantContextItem('structured', {
      title: `Alert: ${rule.name}`,
      data: {
        rule: {
          name: rule.name,
          uid: rule.uid,
          labels: rule.labels,
          query: rule.query,
        },
      },
    });
  }, [rule]);

  // Generate default prompt
  const analyzeRulePrompt = useMemo(() => buildAnalyzeRulePrompt(rule), [rule]);

  const handleClick = () => {
    reportInteraction('grafana_assistant_app_analyze_rule_button_clicked', {
      origin: 'alerting',
      alertName: rule.name,
      alertState: prometheusRuleType.grafana.alertingRule(rule) ? rule.state : undefined,
    });

    openAssistant({
      origin: 'alerting',
      mode: 'assistant',
      prompt: analyzeRulePrompt,
      context: [alertContext],
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
 * Builds a prompt for analyzing a rule (alerting or recording).
 * Automatically detects the rule type and uses the appropriate prompt builder.
 */
function buildAnalyzeRulePrompt(rule: GrafanaRule): string {
  if (prometheusRuleType.grafana.alertingRule(rule)) {
    return buildAnalyzeAlertingRulePrompt(rule);
  } else if (prometheusRuleType.grafana.recordingRule(rule)) {
    return buildAnalyzeRecordingRulePrompt(rule);
  }
  // Fallback (should not happen for GrafanaRule, but TypeScript requires it)
  return `Analyze the rule "${rule.name}".`;
}

/**
 * Builds a prompt for analyzing an alerting rule.
 * Includes state, activeAt timestamp, annotations, and labels.
 */
function buildAnalyzeAlertingRulePrompt(rule: GrafanaAlertingRule): string {
  const state = rule.state || 'firing';
  const timeInfo = rule.activeAt ? ` starting at ${new Date(rule.activeAt).toISOString()}` : '';
  const alertsNavigationPrompt = config.featureToggles.alertingTriage
    ? '\n- Include navigation to follow up on the alerts page'
    : '';

  let prompt = `
  Analyze the ${state} alert "${rule.name} (uid: ${rule.uid})"${timeInfo}.
- Get the rule definition, read the queries and run them to understand the rule
- Get the rule state and instances to understand its current state
- Read the rule conditions and understand how it works. Then suggest query and conditions improvements if applicable${alertsNavigationPrompt}
  `;

  const description = rule.annotations?.description || rule.annotations?.summary || '';
  if (description) {
    prompt += ` ${description}`;
  }

  const labelsStr = rule.labels
    ? Object.entries(rule.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(', ')
    : '';
  if (labelsStr) {
    prompt += ` Labels: ${labelsStr}.`;
  }

  return prompt;
}

/**
 * Builds a prompt for analyzing a recording rule.
 * Includes name, query, and labels (no state or activeAt).
 */
function buildAnalyzeRecordingRulePrompt(rule: GrafanaRecordingRule): string {
  const labelsStr = rule.labels
    ? Object.entries(rule.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(', ')
    : '';

  let prompt = `Analyze the recording rule "${rule.name}".`;

  if (labelsStr) {
    prompt += ` Labels: ${labelsStr}.`;
  }

  return prompt;
}
