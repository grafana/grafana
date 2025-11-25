import {useMemo } from 'react';

import { OpenAssistantProps, createAssistantContextItem, useAssistant } from '@grafana/assistant';
import { reportInteraction } from '@grafana/runtime';
import { Menu } from '@grafana/ui';
import { AlertingRule } from 'app/types/unified-alerting';

export interface AnalyzeRuleButtonProps {
  /** Alert data to investigate */
  alertRule: AlertingRule;
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
  alertRule,
  openAssistant,
}: AnalyzeRuleButtonProps & {
  openAssistant: (props: OpenAssistantProps) => void;
}) {
  // Create alert context from alert data
  const alertContext = useMemo(() => {
    return createAssistantContextItem('structured', {
      title: `Alert: ${alertRule.name}`,
      data: {
        alert: {
          name: alertRule.name,
          uid: alertRule.uid,
          state: alertRule.state,
          labels: alertRule.labels,
          annotations: alertRule.annotations,
          query: alertRule.query,
          activeAt: alertRule.activeAt,
          duration: alertRule.duration,
          value: alertRule.alerts?.[0]?.value,
        },
      },
    });
  }, [alertRule]);

  // Generate default prompt
  const investigationPrompt = useMemo(() => {
    const state = alertRule.state || 'firing';
    const timeInfo = alertRule.activeAt
      ? ` starting at ${new Date(alertRule.activeAt).toISOString()}`
      : '';

    const description = alertRule.annotations?.description || alertRule.annotations?.summary || '';
    const labelsStr = alertRule.labels
      ? Object.entries(alertRule.labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(', ')
      : '';

    let defaultPrompt = `Analyze the ${state} alert "${alertRule.name}"${timeInfo}.`;

    if (description) {
      defaultPrompt += ` ${description}`;
    }

    if (labelsStr) {
      defaultPrompt += ` Labels: ${labelsStr}.`;
    }

    return defaultPrompt;
  }, [alertRule]);


  const handleClick = () => {
    reportInteraction('grafana_assistant_app_trigger_investigation_button_clicked', {
      origin: 'alerting',
      alertName: alertRule.name,
      alertState: alertRule.state,
    });

    openAssistant({
      origin: 'alerting',
      mode: 'assistant',
      prompt: investigationPrompt,
      context: [alertContext],
      autoSend: true,
    });
  };

  return (
    <Menu.Item
      label="Analyze alert"
      icon="search"
      onClick={handleClick}
      data-testid="trigger-investigation-menu-item"
    />
  );
}
