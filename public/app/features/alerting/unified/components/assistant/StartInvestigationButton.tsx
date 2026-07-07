import { useMemo } from 'react';

import { type OpenAssistantProps, createAssistantContextItem, useAssistant } from '@grafana/assistant';
import { t } from '@grafana/i18n';
import { Menu } from '@grafana/ui';
import { type GrafanaAlertingRule } from 'app/types/unified-alerting';

interface StartInvestigationButtonProps {
  /** Alerting rule to investigate */
  rule: GrafanaAlertingRule;
}

/**
 * A menu item that starts an assistant investigation for an alert rule.
 * Opens the assistant in investigations mode with rule context.
 */
export function StartInvestigationButton(props: StartInvestigationButtonProps) {
  const { isAvailable, openAssistant } = useAssistant();

  if (!isAvailable || !openAssistant) {
    return null;
  }

  return <StartInvestigationButtonView {...props} openAssistant={openAssistant} />;
}

function StartInvestigationButtonView({
  rule,
  openAssistant,
}: StartInvestigationButtonProps & {
  openAssistant: (props: OpenAssistantProps) => void;
}) {
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

  const investigationPrompt = useMemo(() => buildStartAlertingRuleInvestigationPrompt(rule), [rule]);

  const handleClick = () => {
    openAssistant({
      origin: 'alerting/start-investigation-menu-item',
      mode: 'investigations',
      prompt: investigationPrompt,
      context: [alertContext],
      autoSend: true,
    });
  };

  return (
    <Menu.Item
      label={t('alerting.alert-menu.start-investigation', 'Start investigation')}
      icon="search-plus"
      onClick={handleClick}
      data-testid="start-investigation-menu-item"
    />
  );
}

function buildStartAlertingRuleInvestigationPrompt(rule: GrafanaAlertingRule): string {
  const state = rule.state || 'firing';
  const timeInfo = rule.activeAt ? ` starting at ${new Date(rule.activeAt).toISOString()}` : '';

  let prompt = `Start an investigation for the ${state} alert "${rule.name} (uid: ${rule.uid})"${timeInfo}.
- Get the rule definition and understand its conditions
- Investigate the current alert state and active instances
- Identify the root cause and contributing factors
- Summarize findings and suggest remediation steps`;

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
