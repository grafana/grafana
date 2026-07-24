import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useMemo, useState } from 'react';

import { type Labels } from '@grafana/data';
import { useDispatch } from 'app/types/store';
import { GrafanaAlertState, type GrafanaRuleDefinition } from 'app/types/unified-alerting-dto';

import { assistantApi, stableFromAlertRequest } from '../../api/assistantApi';
import { usePluginBridge } from '../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../types/pluginBridges';
import { createAbsoluteUrl } from '../../utils/url';

import {
  ASSISTANT_INVESTIGATION_POLL_INTERVAL_MS,
  buildFromAlertRequest,
  getAssistantInvestigationUrl,
  isAssistantInvestigationCompleted,
  isAssistantInvestigationFailed,
  isAssistantInvestigationTerminal,
  isManualAssistantInvestigationEnabled,
  selectAssistantInvestigation,
} from './startInvestigationFromAlert';

export interface UseStartInvestigationArgs {
  instanceLabels: Labels;
  commonLabels?: Labels;
  rule?: GrafanaRuleDefinition;
  alertState?: GrafanaAlertState | null;
  /** ISO timestamp when this firing episode began; omit when unknown. */
  alertStartsAt?: string;
}

/**
 * View model for {@link StartInvestigationButton}.
 * The hook owns plugin/feature gating, request identity, RTK Query calls, and polling.
 */
export type StartInvestigationViewModel =
  | { status: 'hidden' }
  | { status: 'waitingIdentity' }
  | { status: 'lookingUp' }
  | { status: 'lookupError'; onRetry: () => void }
  | { status: 'completed'; href: string }
  | { status: 'starting' }
  | { status: 'startError'; onStart: () => void }
  | { status: 'reportFailed'; href: string; onStart: () => void }
  | { status: 'pollError'; href: string; onRetry: () => void }
  | { status: 'running'; href: string }
  | { status: 'open'; href: string }
  | { status: 'idle'; onStart: () => void };

/**
 * Owns Assistant investigation state for a firing alert instance: lookup, start,
 * poll-until-terminal, and URL generation. Returns a simple status map for the button UI.
 */
export function useStartInvestigation({
  instanceLabels,
  commonLabels,
  rule,
  alertState,
  alertStartsAt,
}: UseStartInvestigationArgs): StartInvestigationViewModel {
  const dispatch = useDispatch();
  const featureEnabled = isManualAssistantInvestigationEnabled();
  const { installed } = usePluginBridge(SupportedPlugin.Assistant);

  // Stable identity for RTK Query cache keys — omit startsAt/status/name/generatorURL
  // (those are attached only on create). Wait for rule identity when the instance has
  // no labels, otherwise early Start/lookup can hash a different group key once the
  // rule arrives.
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
  // (create-only fields stripped via stableFromAlertRequest).
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
    // Drawer remount must not trust a start-time pending upsert forever.
    refetchOnMountOrArgChange: true,
  });

  const knownId = startedInvestigation?.id ?? lookedUpInvestigation?.id;
  const [shouldPoll, setShouldPoll] = useState(false);

  const {
    data: polledInvestigation,
    isError: isPollError,
    refetch: refetchPoll,
  } = assistantApi.useGetAssistantInvestigationQuery(knownId ?? '', {
    skip: !featureEnabled || !installed || !knownId,
    pollingInterval: shouldPoll ? ASSISTANT_INVESTIGATION_POLL_INTERVAL_MS : 0,
    refetchOnMountOrArgChange: true,
  });

  // Prefer the create/retry snapshot until poll has data for that same investigation
  // id. Terminal same-id snapshots from lookup always beat stale pending caches —
  // see selectAssistantInvestigation.
  const investigation = useMemo(
    () =>
      selectAssistantInvestigation({
        started: startedInvestigation,
        polled: polledInvestigation,
        lookedUp: lookedUpInvestigation,
      }),
    [polledInvestigation, startedInvestigation, lookedUpInvestigation]
  );

  // Keep lookup cache aligned with poll so reopen does not restore a stale
  // pending/in_progress snapshot after the report already finished. Never write a
  // stale non-terminal poll over a fresher terminal lookup for the same id.
  useEffect(() => {
    if (!requestBody || !polledInvestigation) {
      return;
    }
    if (
      lookedUpInvestigation &&
      lookedUpInvestigation.id === polledInvestigation.id &&
      isAssistantInvestigationTerminal(lookedUpInvestigation.state) &&
      !isAssistantInvestigationTerminal(polledInvestigation.state)
    ) {
      // Heal the stale get cache from the fresher lookup so poll preference stays correct.
      dispatch(
        assistantApi.util.upsertQueryData('getAssistantInvestigation', lookedUpInvestigation.id, lookedUpInvestigation)
      );
      return;
    }
    dispatch(assistantApi.util.upsertQueryData('lookupInvestigationFromAlert', requestBody, polledInvestigation));
  }, [dispatch, requestBody, polledInvestigation, lookedUpInvestigation]);

  // Drop a stale create-time pending mutation once lookup/poll knows the same id is terminal.
  useEffect(() => {
    if (
      !startedInvestigation ||
      !investigation ||
      investigation.id !== startedInvestigation.id ||
      !isAssistantInvestigationTerminal(investigation.state) ||
      isAssistantInvestigationTerminal(startedInvestigation.state)
    ) {
      return;
    }
    reset();
  }, [investigation, startedInvestigation, reset]);

  const investigationFailed = isAssistantInvestigationFailed(investigation?.state);

  useEffect(() => {
    if (!knownId || isPollError) {
      // Stop on poll failure so we don't keep spinning "Generating…" with no recovery.
      setShouldPoll(false);
      return;
    }
    // Keep polling until a terminal state — unknown/paused must not freeze the UI.
    setShouldPoll(!isAssistantInvestigationTerminal(investigation?.state ?? 'pending'));
  }, [knownId, investigation?.state, isPollError]);

  const onStart = () => {
    if (!requestBody) {
      return;
    }
    const status = alertState === GrafanaAlertState.Normal ? 'resolved' : 'firing';
    const generatorURL = rule?.uid ? createAbsoluteUrl(`/alerting/grafana/${rule.uid}/view`) : undefined;
    startInvestigation({
      ...requestBody,
      name: rule?.title,
      alerts: requestBody.alerts.map((alert) => ({
        ...alert,
        // Prefer the real firing-episode start from state history. Omit rather
        // than inventing click time — Assistant uses startsAt for context.
        ...(alertStartsAt ? { startsAt: alertStartsAt } : {}),
        status,
        generatorURL,
      })),
    });
  };

  if (!featureEnabled || !installed) {
    return { status: 'hidden' };
  }

  if (!hasStableIdentity) {
    return { status: 'waitingIdentity' };
  }

  if (isLookingUp && !investigation) {
    return { status: 'lookingUp' };
  }

  if (isLookupError && !investigation) {
    return { status: 'lookupError', onRetry: () => refetchLookup() };
  }

  if (investigation && isAssistantInvestigationCompleted(investigation.state)) {
    return { status: 'completed', href: getAssistantInvestigationUrl(investigation.id) };
  }

  if (isStarting) {
    return { status: 'starting' };
  }

  // Prefer reportFailed over startError when a failed/cancelled investigation is
  // already known — a retry mutation error must not hide "Open failed report".
  if (investigationFailed && investigation) {
    // Retry POSTs from-alert again; the Assistant manual path creates a fresh
    // investigation for failed/cancelled.
    return {
      status: 'reportFailed',
      href: getAssistantInvestigationUrl(investigation.id),
      onStart,
    };
  }

  if (isStartError) {
    return { status: 'startError', onStart };
  }

  if (isPollError && knownId && !isAssistantInvestigationTerminal(investigation?.state)) {
    // Keep the workspace link — a refresh error does not invalidate the id.
    return {
      status: 'pollError',
      href: getAssistantInvestigationUrl(knownId),
      onRetry: () => refetchPoll(),
    };
  }

  if (investigation && !isAssistantInvestigationTerminal(investigation.state)) {
    return { status: 'running', href: getAssistantInvestigationUrl(investigation.id) };
  }

  if (investigation) {
    return { status: 'open', href: getAssistantInvestigationUrl(investigation.id) };
  }

  return { status: 'idle', onStart };
}
