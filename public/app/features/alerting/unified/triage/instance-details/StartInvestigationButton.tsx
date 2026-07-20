import { useEffect, useMemo, useState } from 'react';

import { type Labels } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, LinkButton, Spinner, Stack, Text, Tooltip } from '@grafana/ui';
import { GrafanaAlertState, type GrafanaRuleDefinition } from 'app/types/unified-alerting-dto';

import {
  ASSISTANT_INVESTIGATION_POLL_INTERVAL_MS,
  type StartInvestigationFromAlertRequest,
  assistantApi,
  getAssistantInvestigationUrl,
  isAssistantInvestigationActive,
  isAssistantInvestigationCompleted,
  isAssistantInvestigationFailed,
  isAssistantInvestigationTerminal,
} from '../../api/assistantApi';
import { usePluginBridge } from '../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../types/pluginBridges';
import { createAbsoluteUrl } from '../../utils/url';

interface StartInvestigationButtonProps {
  instanceLabels: Labels;
  commonLabels?: Labels;
  rule?: GrafanaRuleDefinition;
  alertState?: GrafanaAlertState | null;
}

/** True when both product toggles for the manual investigation entry point are on. */
export function isManualAssistantInvestigationEnabled(): boolean {
  return Boolean(
    config.featureToggles.alertingEnrichmentAssistantInvestigations &&
      config.featureToggles.alertingManualAssistantInvestigation
  );
}

/**
 * POC: lets a responder manually start (or open) a Grafana Assistant investigation
 * for the firing alert instance they are looking at. Mirrors the three states of the
 * incident-sidebar treatment (not started / running / completed).
 *
 * The Assistant dedups by alert group (`groupLabels`), so pressing this repeatedly
 * opens the existing investigation rather than creating duplicates. Reopening the
 * drawer looks up that same link and polls until the report completes.
 */
export function StartInvestigationButton({
  instanceLabels,
  commonLabels,
  rule,
  alertState,
}: StartInvestigationButtonProps) {
  const featureEnabled = isManualAssistantInvestigationEnabled();
  const { installed } = usePluginBridge(SupportedPlugin.Assistant);

  // Stable identity for RTK Query cache keys — omit startsAt (set only on create).
  const requestBody = useMemo(
    () => buildFromAlertRequest({ instanceLabels, commonLabels, rule, alertState }),
    // Labels are plain objects from parents; stringify keeps the body stable across
    // equivalent re-renders so lookup does not thrash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(instanceLabels), JSON.stringify(commonLabels), rule?.uid, rule?.title, alertState]
  );

  const requestBodyKey = useMemo(() => JSON.stringify(requestBody), [requestBody]);

  const [startInvestigation, { isLoading, data, isError, reset, originalArgs }] =
    assistantApi.useStartInvestigationFromAlertMutation();

  // Mutation result is shared RTK state. Only trust it for the current alert identity
  // (startsAt is set only on create, so strip it before comparing).
  const mutationMatchesCurrent = useMemo(() => {
    if (!originalArgs) {
      return false;
    }
    const normalized = {
      ...originalArgs,
      alerts: originalArgs.alerts.map(({ startsAt: _startsAt, ...alert }) => alert),
    };
    return JSON.stringify(normalized) === requestBodyKey;
  }, [originalArgs, requestBodyKey]);

  const startedInvestigation = mutationMatchesCurrent ? data : undefined;
  const isStarting = mutationMatchesCurrent && isLoading;
  const isStartError = mutationMatchesCurrent && isError;

  // Drop stale mutation state when the drawer switches instances.
  useEffect(() => {
    if (!mutationMatchesCurrent) {
      reset();
    }
  }, [mutationMatchesCurrent, reset]);

  const { data: lookedUpInvestigation, isLoading: isLookingUp } = assistantApi.useLookupInvestigationFromAlertQuery(
    requestBody,
    { skip: !featureEnabled || !installed }
  );

  const knownId = startedInvestigation?.id ?? lookedUpInvestigation?.id;
  const [shouldPoll, setShouldPoll] = useState(false);

  const { data: polledInvestigation } = assistantApi.useGetAssistantInvestigationQuery(knownId ?? '', {
    skip: !featureEnabled || !installed || !knownId,
    pollingInterval: shouldPoll ? ASSISTANT_INVESTIGATION_POLL_INTERVAL_MS : 0,
  });

  // Prefer the polled row (fresh state) over the create/lookup snapshots.
  const investigation = polledInvestigation ?? startedInvestigation ?? lookedUpInvestigation ?? undefined;

  useEffect(() => {
    if (!knownId) {
      setShouldPoll(false);
      return;
    }
    // Keep polling until a terminal state — unknown/paused must not freeze the UI.
    setShouldPoll(!isAssistantInvestigationTerminal(investigation?.state ?? 'pending'));
  }, [knownId, investigation?.state]);

  if (!featureEnabled || !installed) {
    return null;
  }

  const handleStart = () => {
    const startsAt = new Date().toISOString();
    startInvestigation({
      ...requestBody,
      alerts: requestBody.alerts.map((alert) => ({ ...alert, startsAt })),
    });
  };

  if (isLookingUp && !investigation) {
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
  }

  if (investigation && isAssistantInvestigationCompleted(investigation.state)) {
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

  if (investigation && isAssistantInvestigationActive(investigation.state)) {
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
          href={getAssistantInvestigationUrl(investigation.id)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Trans i18nKey="alerting.triage.instance-details-drawer.investigation-watch-live">
            Watch live in assistant workspace
          </Trans>
        </LinkButton>
      </Stack>
    );
  }

  if (isStarting) {
    return (
      <Button icon="ai-sparkle" variant="primary" fill="text" size="sm" disabled>
        <Trans i18nKey="alerting.triage.instance-details-drawer.investigation-starting">Starting…</Trans>
      </Button>
    );
  }

  if (isStartError || isAssistantInvestigationFailed(investigation?.state)) {
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

  // Known investigation in an unexpected state — open it; never offer Start (would mislead).
  if (investigation) {
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

/** Exported for unit tests — builds the stable from-alert payload (no startsAt). */
export function buildFromAlertRequest({
  instanceLabels,
  commonLabels,
  rule,
  alertState,
}: StartInvestigationButtonProps): StartInvestigationFromAlertRequest {
  const generatorURL = rule?.uid ? createAbsoluteUrl(`/alerting/grafana/${rule.uid}/view`) : undefined;
  const externalURL = config.appUrl.replace(/\/$/, '');

  // Stable alert-group identity for Assistant dedup/lookup. Prefer instance labels;
  // when an instance has none, fall back to rule identity so reopen still finds the link.
  const groupLabels: Record<string, string> =
    Object.keys(instanceLabels).length > 0
      ? { ...instanceLabels }
      : {
          ...(rule?.title ? { alertname: rule.title } : {}),
          ...(rule?.uid ? { rule_uid: rule.uid } : {}),
        };

  return {
    name: rule?.title,
    alerts: [
      {
        labels: instanceLabels,
        status: alertState === GrafanaAlertState.Normal ? 'resolved' : 'firing',
        generatorURL,
      },
    ],
    commonLabels,
    groupLabels,
    externalURL,
  };
}
