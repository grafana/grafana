import { type Labels } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, LinkButton, Spinner, Stack, Text, Tooltip } from '@grafana/ui';
import { type GrafanaAlertState, type GrafanaRuleDefinition } from 'app/types/unified-alerting-dto';

import { useStartInvestigation } from './useStartInvestigation';

interface StartInvestigationButtonProps {
  instanceLabels: Labels;
  commonLabels?: Labels;
  rule?: GrafanaRuleDefinition;
  alertState?: GrafanaAlertState | null;
  /** ISO timestamp when this firing episode began (from state history). */
  alertStartsAt?: string;
}

/**
 * POC: lets a responder manually start (or open) a Grafana Assistant investigation
 * for the firing alert instance they are looking at. Mirrors the three states of the
 * incident-sidebar treatment (not started / running / completed).
 *
 * State, API calls, and URL generation live in {@link useStartInvestigation}.
 */
export function StartInvestigationButton({
  instanceLabels,
  commonLabels,
  rule,
  alertState,
  alertStartsAt,
}: StartInvestigationButtonProps) {
  const view = useStartInvestigation({ instanceLabels, commonLabels, rule, alertState, alertStartsAt });

  switch (view.status) {
    case 'hidden':
      return null;

    case 'waitingIdentity':
      return (
        <Tooltip
          content={t(
            'alerting.triage.instance-details-drawer.investigation-waiting-identity',
            'Waiting for alert details before starting an investigation.'
          )}
        >
          <Button icon="ai-sparkle" variant="primary" fill="text" size="sm" disabled>
            <Trans i18nKey="alerting.triage.instance-details-drawer.start-investigation">Start investigation</Trans>
          </Button>
        </Tooltip>
      );

    case 'lookingUp':
      return (
        <Stack direction="row" alignItems="center" gap={1}>
          <Spinner size="sm" inline />
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="alerting.triage.instance-details-drawer.investigation-checking">
              Checking for investigation…
            </Trans>
          </Text>
        </Stack>
      );

    case 'lookupError':
      return (
        <Tooltip
          content={t(
            'alerting.triage.instance-details-drawer.investigation-lookup-failed',
            'Could not check for an existing investigation. Try again.'
          )}
        >
          <Button icon="ai-sparkle" variant="primary" fill="text" size="sm" onClick={view.onRetry}>
            <Trans i18nKey="alerting.triage.instance-details-drawer.investigation-lookup-retry">Retry check</Trans>
          </Button>
        </Tooltip>
      );

    case 'completed':
    case 'open':
      return (
        <LinkButton
          icon="file-alt"
          variant="primary"
          fill="text"
          size="sm"
          href={view.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Trans i18nKey="alerting.triage.instance-details-drawer.open-investigation">
            Open full investigation report
          </Trans>
        </LinkButton>
      );

    case 'starting':
      return (
        <Button icon="ai-sparkle" variant="primary" fill="text" size="sm" disabled>
          <Trans i18nKey="alerting.triage.instance-details-drawer.investigation-starting">Starting…</Trans>
        </Button>
      );

    case 'startError':
      return (
        <Tooltip
          content={t(
            'alerting.triage.instance-details-drawer.investigation-start-failed',
            'Could not start the investigation. Try again.'
          )}
        >
          <Button icon="ai-sparkle" variant="primary" fill="text" size="sm" onClick={view.onStart}>
            <Trans i18nKey="alerting.triage.instance-details-drawer.start-investigation">Start investigation</Trans>
          </Button>
        </Tooltip>
      );

    case 'reportFailed':
      return (
        <Stack direction="row" alignItems="center" gap={1}>
          <Tooltip
            content={t(
              'alerting.triage.instance-details-drawer.investigation-report-failed',
              'The investigation report failed or was cancelled. You can open it or try again.'
            )}
          >
            <Button icon="ai-sparkle" variant="primary" fill="text" size="sm" onClick={view.onStart}>
              <Trans i18nKey="alerting.triage.instance-details-drawer.start-investigation">Start investigation</Trans>
            </Button>
          </Tooltip>
          <LinkButton
            icon="file-alt"
            variant="primary"
            fill="text"
            size="sm"
            href={view.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Trans i18nKey="alerting.triage.instance-details-drawer.open-failed-investigation">
              Open failed report
            </Trans>
          </LinkButton>
        </Stack>
      );

    case 'pollError':
      return (
        <Stack direction="row" alignItems="center" gap={1}>
          <Tooltip
            content={t(
              'alerting.triage.instance-details-drawer.investigation-poll-failed',
              'Could not refresh investigation status. Try again.'
            )}
          >
            <Button icon="ai-sparkle" variant="primary" fill="text" size="sm" onClick={view.onRetry}>
              <Trans i18nKey="alerting.triage.instance-details-drawer.investigation-poll-retry">Retry status</Trans>
            </Button>
          </Tooltip>
          <LinkButton
            icon="comment-alt"
            variant="primary"
            fill="text"
            size="sm"
            href={view.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Trans i18nKey="alerting.triage.instance-details-drawer.investigation-watch-live">
              Watch live in assistant workspace
            </Trans>
          </LinkButton>
        </Stack>
      );

    case 'running':
      return (
        <Stack direction="row" alignItems="center" gap={1}>
          <Spinner size="sm" inline />
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="alerting.triage.instance-details-drawer.investigation-running">
              Generating investigation report…
            </Trans>
          </Text>
          <LinkButton
            icon="comment-alt"
            variant="primary"
            fill="text"
            size="sm"
            href={view.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Trans i18nKey="alerting.triage.instance-details-drawer.investigation-watch-live">
              Watch live in assistant workspace
            </Trans>
          </LinkButton>
        </Stack>
      );

    case 'idle':
      return (
        <Tooltip
          content={t(
            'alerting.triage.instance-details-drawer.start-investigation-tooltip',
            'Assistant will draft it in your workspace'
          )}
        >
          <Button icon="ai-sparkle" variant="primary" fill="text" size="sm" onClick={view.onStart}>
            <Trans i18nKey="alerting.triage.instance-details-drawer.start-investigation">Start investigation</Trans>
          </Button>
        </Tooltip>
      );
  }
}
