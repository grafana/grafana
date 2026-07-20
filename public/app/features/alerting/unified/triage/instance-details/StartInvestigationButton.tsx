import { skipToken } from '@reduxjs/toolkit/query';
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

  // Stable identity for RTK Query cache keys — omit startsAt/status (set only on create).
  // Wait for rule identity when the instance has no labels, otherwise early Start/lookup
  // can hash a different group key than later requests once the rule arrives.
  const hasStableIdentity = Object.keys(instanceLabels).length > 0 || Boolean(rule?.uid) || Boolean(rule?.title);

  const requestBody = useMemo(
    () => (hasStableIdentity ? buildFromAlertRequest({ instanceLabels, commonLabels, rule }) : null),
    // Labels are plain objects from parents; stringify keeps the body stable across
    // equivalent re-renders so lookup does not thrash. alertState is intentionally
    // excluded — firing↔resolved must not change the cache key mid-drawer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(instanceLabels), JSON.stringify(commonLabels), rule?.uid, rule?.title, hasStableIdentity]
  );

  const requestBodyKey = useMemo(() => (requestBody ? JSON.stringify(requestBody) : ''), [requestBody]);

  const [startInvestigation, { isLoading, data, isError, reset, originalArgs }] =
    assistantApi.useStartInvestigationFromAlertMutation();

  // Mutation result is shared RTK state. Only trust it for the current alert identity
  // (startsAt/status are set only on create, so strip them before comparing).
  const mutationMatchesCurrent = useMemo(() => {
    if (!originalArgs || !requestBodyKey) {
      return false;
    }
    return JSON.stringify(stableFromAlertRequest(originalArgs)) === requestBodyKey;
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

  const {
    data: lookedUpInvestigation,
    isLoading: isLookingUp,
    isError: isLookupError,
    refetch: refetchLookup,
  } = assistantApi.useLookupInvestigationFromAlertQuery(requestBody ?? skipToken, {
    skip: !featureEnabled || !installed,
  });

  const knownId = startedInvestigation?.id ?? lookedUpInvestigation?.id;
  const [shouldPoll, setShouldPoll] = useState(false);

  const { data: polledInvestigation } = assistantApi.useGetAssistantInvestigationQuery(knownId ?? '', {
    skip: !featureEnabled || !installed || !knownId,
    pollingInterval: shouldPoll ? ASSISTANT_INVESTIGATION_POLL_INTERVAL_MS : 0,
  });

  // Prefer the polled row (fresh state) over the create/lookup snapshots.
  const investigation = polledInvestigation ?? startedInvestigation ?? lookedUpInvestigation ?? undefined;
  const investigationFailed = isAssistantInvestigationFailed(investigation?.state);

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
    if (!requestBody) {
      return;
    }
    const startsAt = new Date().toISOString();
    const status = alertState === GrafanaAlertState.Normal ? 'resolved' : 'firing';
    startInvestigation({
      ...requestBody,
      alerts: requestBody.alerts.map((alert) => ({ ...alert, startsAt, status })),
    });
  };

  if ((!hasStableIdentity || isLookingUp) && !investigation) {
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

  // Non-404 lookup failures must not look like "no investigation" (would offer Start incorrectly).
  if (isLookupError && !investigation) {
    return (
      <Tooltip
        content={t(
          'alerting.triage.instance-details-drawer.investigation-lookup-failed',
          'Could not check for an existing investigation. Try again.'
        )}
      >
        <Button icon="ai-sparkle" variant="primary" fill="text" size="sm" onClick={() => refetchLookup()}>
          <Trans i18nKey="alerting.triage.instance-details-drawer.investigation-lookup-retry">Retry check</Trans>
        </Button>
      </Tooltip>
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

  if (isStarting) {
    return (
      <Button icon="ai-sparkle" variant="primary" fill="text" size="sm" disabled>
        <Trans i18nKey="alerting.triage.instance-details-drawer.investigation-starting">Starting…</Trans>
      </Button>
    );
  }

  if (isStartError) {
    return (
      <Tooltip
        content={t(
          'alerting.triage.instance-details-drawer.investigation-start-failed',
          'Could not start the investigation. Try again.'
        )}
      >
        <Button icon="ai-sparkle" variant="primary" fill="text" size="sm" onClick={handleStart}>
          <Trans i18nKey="alerting.triage.instance-details-drawer.start-investigation">Start investigation</Trans>
        </Button>
      </Tooltip>
    );
  }

  if (investigationFailed && investigation) {
    return (
      <Tooltip
        content={t(
          'alerting.triage.instance-details-drawer.investigation-report-failed',
          'The investigation report failed or was cancelled. You can try again.'
        )}
      >
        <Button icon="ai-sparkle" variant="primary" fill="text" size="sm" onClick={handleStart}>
          <Trans i18nKey="alerting.triage.instance-details-drawer.start-investigation">Start investigation</Trans>
        </Button>
      </Tooltip>
    );
  }

  // Active, paused, or any non-terminal/unknown state — keep generating UI while polling.
  if (investigation && !isAssistantInvestigationTerminal(investigation.state)) {
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

  // Known investigation in an unexpected terminal state — open it; never offer Start.
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

/**
 * Strips per-delivery alert fields so create/lookup share one RTK cache identity.
 * startsAt and status change while the drawer is open; group identity does not.
 */
export function stableFromAlertRequest(body: StartInvestigationFromAlertRequest): StartInvestigationFromAlertRequest {
  return {
    ...body,
    alerts: body.alerts.map(({ startsAt: _startsAt, status: _status, ...alert }) => alert),
  };
}

/** Exported for unit tests — builds the stable from-alert payload (no startsAt/status). */
export function buildFromAlertRequest({
  instanceLabels,
  commonLabels,
  rule,
}: Omit<StartInvestigationButtonProps, 'alertState'>): StartInvestigationFromAlertRequest {
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
        generatorURL,
      },
    ],
    commonLabels,
    groupLabels,
    externalURL,
  };
}
