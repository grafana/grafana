import { type Labels } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, LinkButton, Spinner, Stack, Text, Tooltip } from '@grafana/ui';
import { GrafanaAlertState, type GrafanaRuleDefinition } from 'app/types/unified-alerting-dto';

import {
  type StartInvestigationFromAlertRequest,
  assistantApi,
  getAssistantInvestigationUrl,
} from '../../api/assistantApi';
import { usePluginBridge } from '../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../types/pluginBridges';

interface StartInvestigationButtonProps {
  instanceLabels: Labels;
  commonLabels?: Labels;
  rule?: GrafanaRuleDefinition;
  alertState?: GrafanaAlertState | null;
}

/**
 * POC: lets a responder manually start (or open) a Grafana Assistant investigation
 * for the firing alert instance they are looking at. Mirrors the three states of the
 * incident-sidebar treatment (not started / running / completed).
 *
 * The Assistant dedups by alert group, so pressing this repeatedly opens the existing
 * investigation rather than creating duplicates.
 */
export function StartInvestigationButton({
  instanceLabels,
  commonLabels,
  rule,
  alertState,
}: StartInvestigationButtonProps) {
  const { installed } = usePluginBridge(SupportedPlugin.Assistant);
  const [startInvestigation, { isLoading, data: investigation, isError }] =
    assistantApi.useStartInvestigationFromAlertMutation();

  // Only offered when the Assistant is available.
  // TEMPORARY (local preview only): gate relaxed so the button renders without the
  // Assistant plugin installed. Restore before committing:
  //   if (!installed) {
  //     return null;
  //   }
  void installed;

  const handleStart = () => {
    const generatorURL = rule?.uid ? `${window.location.origin}/alerting/grafana/${rule.uid}/view` : undefined;
    const body: StartInvestigationFromAlertRequest = {
      name: rule?.title,
      alerts: [
        {
          labels: instanceLabels,
          annotations: rule?.annotations,
          status: alertState === GrafanaAlertState.Normal ? 'resolved' : 'firing',
          startsAt: new Date().toISOString(),
          generatorURL,
        },
      ],
      commonLabels,
      externalURL: window.location.origin,
    };
    startInvestigation(body);
  };

  // Completed — link straight to the report in the Assistant workspace.
  if (investigation && investigation.state === 'completed') {
    return (
      <LinkButton
        icon="file-alt"
        variant="primary"
        fill="text"
        size="sm"
        href={getAssistantInvestigationUrl(investigation.id)}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Trans i18nKey="alerting.triage.instance-details-drawer.open-investigation">
          Open full investigation report
        </Trans>
      </LinkButton>
    );
  }

  // Running — the Assistant is analyzing; offer a live link into the workspace.
  const isRunning = investigation?.state === 'running' || investigation?.state === 'pending';
  if (isRunning) {
    return (
      <Stack direction="row" alignItems="center" gap={1}>
        <Spinner size="sm" inline />
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="alerting.triage.instance-details-drawer.investigation-running">
            Generating investigation report…
          </Trans>
        </Text>
        {investigation?.id && (
          <LinkButton
            icon="comment-alt"
            variant="primary"
            fill="text"
            size="sm"
            href={getAssistantInvestigationUrl(investigation.id)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Trans i18nKey="alerting.triage.instance-details-drawer.investigation-watch-live">
              Watch live in assistant workspace
            </Trans>
          </LinkButton>
        )}
      </Stack>
    );
  }

  if (isLoading) {
    return (
      <Button icon="ai-sparkle" variant="primary" fill="text" size="sm" disabled>
        <Trans i18nKey="alerting.triage.instance-details-drawer.investigation-starting">Starting…</Trans>
      </Button>
    );
  }

  // Failed — surface the error and let the user retry.
  if (isError || investigation?.state === 'failed') {
    return (
      <Tooltip
        content={t(
          'alerting.triage.instance-details-drawer.investigation-failed',
          'Could not start the investigation. Try again.'
        )}
      >
        <Button icon="ai-sparkle" variant="primary" fill="text" size="sm" onClick={handleStart}>
          <Trans i18nKey="alerting.triage.instance-details-drawer.start-investigation">Start investigation</Trans>
        </Button>
      </Tooltip>
    );
  }

  // Not started.
  return (
    <Tooltip
      content={t(
        'alerting.triage.instance-details-drawer.start-investigation-tooltip',
        'Assistant will draft it in your workspace'
      )}
    >
      <Button icon="ai-sparkle" variant="primary" fill="text" size="sm" onClick={handleStart}>
        <Trans i18nKey="alerting.triage.instance-details-drawer.start-investigation">Start investigation</Trans>
      </Button>
    </Tooltip>
  );
}
