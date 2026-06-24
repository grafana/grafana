import { type MouseEvent, useCallback, useMemo } from 'react';

import { type OpenAssistantProps, useAssistant } from '@grafana/assistant';
import { type Labels } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Drawer, LoadingPlaceholder, Stack, Text, TextLink } from '@grafana/ui';
import { type GrafanaAlertState, type RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { useIrmPlugin } from '../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../types/pluginBridges';
import { generateAlertDescriptionForGrafanaRule } from '../../utils/alert-annotations';
import { useWorkbenchContext } from '../WorkbenchContext';

import { createExplainAssistantContext } from './explainAssistantContext';
import { buildExplainAssistantQuestions } from './explainAssistantPrompts';
import { extractIncidentHistoryFromRule } from './extractIncidentHistoryFromRule';
import { registerExplainAssistantQuestions } from './registerExplainAssistantQuestions';

function calculateDrawerWidth(rightColumnWidth: number): number {
  const calculatedWidth = rightColumnWidth + 32;
  return Math.max(700, Math.min(calculatedWidth, 1400));
}

interface ExplainDrawerProps {
  rule: RulerGrafanaRuleDTO;
  ruleUID: string;
  instanceLabels: Labels;
  commonLabels?: Labels;
  instanceState?: GrafanaAlertState;
  onClose: () => void;
  /** Closes stacked drawers so the extension sidebar is visible when opening Assistant. */
  onDismissDrawers?: () => void;
}

export function ExplainDrawer(props: ExplainDrawerProps) {
  const { isAvailable, openAssistant } = useAssistant();

  if (!isAvailable || !openAssistant) {
    return <ExplainDrawerView {...props} />;
  }

  return <ExplainDrawerView {...props} openAssistant={openAssistant} />;
}

function ExplainDrawerView({
  rule,
  ruleUID,
  instanceLabels,
  commonLabels,
  instanceState,
  onClose,
  onDismissDrawers,
  openAssistant,
}: ExplainDrawerProps & {
  openAssistant?: (props: OpenAssistantProps) => void;
}) {
  const { rightColumnWidth } = useWorkbenchContext();
  const drawerWidth = calculateDrawerWidth(rightColumnWidth);
  const { installed: irmInstalled } = useIrmPlugin(SupportedPlugin.Incident);

  const description = useMemo(() => generateAlertDescriptionForGrafanaRule(rule), [rule]);
  const ruleTitle = rule.grafana_alert.title;
  const showAssistantLink = Boolean(openAssistant);
  const incidentHistory = useMemo(() => extractIncidentHistoryFromRule(rule), [rule]);

  const assistantContext = useMemo(
    () =>
      createExplainAssistantContext({
        rule,
        ruleUID,
        instanceLabels,
        commonLabels,
        instanceState,
        description,
        incidentHistory,
      }),
    [rule, ruleUID, instanceLabels, commonLabels, instanceState, description, incidentHistory]
  );

  const assistantQuestionOptions = useMemo(
    () => ({
      includeIncidentHistoryPrompt: Boolean(irmInstalled),
      hasLinkedIncidentHistory: incidentHistory !== undefined,
    }),
    [irmInstalled, incidentHistory]
  );

  const handleOpenAssistant = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();

      if (!openAssistant) {
        return;
      }

      reportInteraction('grafana_assistant_app_explain_drawer_opened', {
        origin: 'alerting/triage/explain-drawer',
        ruleUid: ruleUID,
        alertState: instanceState,
      });

      registerExplainAssistantQuestions(buildExplainAssistantQuestions(assistantContext, assistantQuestionOptions));

      onDismissDrawers?.();

      openAssistant({
        origin: 'alerting/triage/explain-drawer',
        mode: 'assistant',
        context: assistantContext,
        autoSend: false,
      });
    },
    [assistantContext, assistantQuestionOptions, instanceState, onDismissDrawers, openAssistant, ruleUID]
  );

  return (
    <Drawer
      title={t('alerting.triage.explain.drawer-title', 'Explain: {{ruleTitle}}', { ruleTitle })}
      subtitle={t(
        'alerting.triage.explain.drawer-subtitle',
        'A plain-language summary of what this alert rule monitors and when it fires'
      )}
      onClose={onClose}
      width={drawerWidth}
    >
      <Stack direction="column" gap={2}>
        <Text>{description}</Text>
        {showAssistantLink && (
          <TextLink href="#" onClick={handleOpenAssistant}>
            <Trans i18nKey="alerting.triage.explain.ai-assistant-link">Explain with Assistant</Trans>
          </TextLink>
        )}
      </Stack>
    </Drawer>
  );
}

export function ExplainDrawerLoading({ onClose }: { onClose: () => void }) {
  const { rightColumnWidth } = useWorkbenchContext();
  const drawerWidth = calculateDrawerWidth(rightColumnWidth);

  return (
    <Drawer title={t('alerting.triage.explain.drawer-title-loading', 'Explain')} onClose={onClose} width={drawerWidth}>
      <LoadingPlaceholder text={t('alerting.common.loading', 'Loading...')} />
    </Drawer>
  );
}
