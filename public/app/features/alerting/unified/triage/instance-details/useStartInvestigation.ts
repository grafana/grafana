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

  // Wait for rule identity when the instance has no labels, otherwise early
  // Start/lookup can hash a different group key once the rule arrives.
  const hasStableIdentity = Object.keys(instanceLabels).length > 0 || Boolean(rule?.uid) || Boolean(rule?.title);

  // Full create payload (may include volatile commonLabels). Identity for cache
  // keys strips those via stableFromAlertRequest — see stableRequestBody.
  const requestBody = useMemo(
    () => (hasStableIdentity ? buildFromAlertRequest({ instanceLabels, commonLabels, rule }) : null),
    // Labels are plain objects from parents; stringify keeps equivalent objects
    // stable. alertState is excluded — firing↔resolved must not change identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(instanceLabels), JSON.stringify(commonLabels), rule?.uid, rule?.title, hasStableIdentity]
  );

  const stableRequestKey = requestBody ? JSON.stringify(stableFromAlertRequest(requestBody)) : '';
  const stableRequestBody = useMemo(
    () => (requestBody ? stableFromAlertRequest(requestBody) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stableRequestKey]
  );

  const [startInvestigation, { isLoading, data, isError, reset, originalArgs }] =
    assistantApi.useStartInvestigationFromAlertMutation();

  // Mutation result is shared RTK state — only trust it for this alert identity.
  const mutationMatchesCurrent = useMemo(() => {
    if (!originalArgs || !stableRequestKey) {
      return false;
    }
    return JSON.stringify(stableFromAlertRequest(originalArgs)) === stableRequestKey;
  }, [originalArgs, stableRequestKey]);

  const startedInvestigation = mutationMatchesCurrent ? data : undefined;
  const isStarting = mutationMatchesCurrent && isLoading;
  const isStartError = mutationMatchesCurrent && isError;

  // Drop stale mutation state when the drawer switches instances.
  useEffect(() => {
    if (!mutationMatchesCurrent) {
      reset();
    }
  }, [mutationMatchesCurrent, reset]);

  // currentData: never reuse a previous alert-group's lookup while the new key loads.
  const {
    currentData: lookedUpInvestigation,
    isLoading: isLookingUp,
    isError: isLookupError,
    refetch: refetchLookup,
  } = assistantApi.useLookupInvestigationFromAlertQuery(stableRequestBody ?? skipToken, {
    skip: !featureEnabled || !installed,
    refetchOnMountOrArgChange: true,
  });

  const knownId = startedInvestigation?.id ?? lookedUpInvestigation?.id;
  const [shouldPoll, setShouldPoll] = useState(false);

  // currentData: after knownId changes (instance switch / retry), do not keep
  // showing or upserting the previous investigation's poll snapshot.
  const {
    currentData: polledInvestigation,
    isError: isPollError,
    refetch: refetchPoll,
  } = assistantApi.useGetAssistantInvestigationQuery(knownId ?? '', {
    skip: !featureEnabled || !installed || !knownId,
    pollingInterval: shouldPoll ? ASSISTANT_INVESTIGATION_POLL_INTERVAL_MS : 0,
    refetchOnMountOrArgChange: true,
  });

  const investigation = useMemo(
    () =>
      selectAssistantInvestigation({
        started: startedInvestigation,
        polled: polledInvestigation,
        lookedUp: lookedUpInvestigation,
      }),
    [polledInvestigation, startedInvestigation, lookedUpInvestigation]
  );

  // Keep lookup aligned with poll so reopen does not restore a stale pending
  // snapshot. Only upsert when poll data is for the current knownId.
  useEffect(() => {
    if (!stableRequestBody || !knownId || !polledInvestigation || polledInvestigation.id !== knownId) {
      return;
    }
    if (
      lookedUpInvestigation &&
      lookedUpInvestigation.id === polledInvestigation.id &&
      isAssistantInvestigationTerminal(lookedUpInvestigation.state) &&
      !isAssistantInvestigationTerminal(polledInvestigation.state)
    ) {
      // Heal stale get cache from a fresher terminal lookup.
      dispatch(
        assistantApi.util.upsertQueryData('getAssistantInvestigation', lookedUpInvestigation.id, lookedUpInvestigation)
      );
      return;
    }
    dispatch(assistantApi.util.upsertQueryData('lookupInvestigationFromAlert', stableRequestBody, polledInvestigation));
  }, [dispatch, stableRequestBody, knownId, polledInvestigation, lookedUpInvestigation]);

  // Clear create-time pending mutation once the same id is known terminal.
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
      setShouldPoll(false);
      return;
    }
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

  // Prefer reportFailed over startError so a retry mutation error does not
  // hide "Open failed report" for an already-known failed investigation.
  if (investigationFailed && investigation) {
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
    return {
      status: 'pollError',
      href: getAssistantInvestigationUrl(knownId),
      onRetry: () => refetchPoll(),
    };
  }

  if (investigation && !isAssistantInvestigationTerminal(investigation.state)) {
    return { status: 'running', href: getAssistantInvestigationUrl(investigation.id) };
  }

  return { status: 'idle', onStart };
}
