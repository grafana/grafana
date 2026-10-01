import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useMemo, useRef, useState } from 'react';

import { type Labels } from '@grafana/data';
import { useDispatch } from 'app/types/store';
import { GrafanaAlertState, type GrafanaRuleDefinition } from 'app/types/unified-alerting-dto';

import { assistantApi, stableFromAlertRequest } from '../../api/assistantApi';
import { usePluginBridge } from '../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../types/pluginBridges';
import { createAbsoluteUrl } from '../../utils/url';

import {
  trackAssistantInvestigationImpression,
  trackAssistantInvestigationOpenReport,
  trackAssistantInvestigationRetry,
  trackAssistantInvestigationStartClicked,
  trackAssistantInvestigationStartFailed,
  trackAssistantInvestigationStartSucceeded,
  trackAssistantInvestigationWatchLive,
} from './assistantInvestigationTracking';
import {
  ASSISTANT_INVESTIGATION_POLL_INTERVAL_MS,
  buildFromAlertRequest,
  getAssistantInvestigationUrl,
  isAssistantInvestigationCompleted,
  isAssistantInvestigationFailed,
  isAssistantInvestigationTerminal,
  selectAssistantInvestigation,
  useManualAssistantInvestigationEnabled,
} from './startInvestigationFromAlert';
import type { StartInvestigationViewModel } from './startInvestigationViewModel';

export interface UseStartInvestigationArgs {
  instanceLabels: Labels;
  commonLabels?: Labels;
  rule?: GrafanaRuleDefinition;
  alertState?: GrafanaAlertState | null;
  /** ISO timestamp when this firing episode began; omit when unknown. */
  alertStartsAt?: string;
  /** ISO timestamp when this firing episode ended; used when the alert is resolved. */
  alertEndsAt?: string;
}

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
  alertEndsAt,
}: UseStartInvestigationArgs): StartInvestigationViewModel {
  const dispatch = useDispatch();
  const featureEnabled = useManualAssistantInvestigationEnabled();
  const { installed } = usePluginBridge(SupportedPlugin.Assistant);
  const impressionTracked = useRef(false);

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

  useEffect(() => {
    if (!featureEnabled || !installed || impressionTracked.current) {
      return;
    }
    trackAssistantInvestigationImpression();
    impressionTracked.current = true;
  }, [featureEnabled, installed]);

  const createOnStart = (fromStatus: 'idle' | 'startError' | 'reportFailed') => async () => {
    if (!requestBody) {
      return;
    }
    // Retries from startError/reportFailed are still starts (from_status), not retry events.
    trackAssistantInvestigationStartClicked({ from_status: fromStatus });

    // Prefer live state when known. When useInstanceAlertState returns null (loading /
    // missing datasource), fall back to history: a closed episode (endsAt, no open
    // startsAt) means resolved — otherwise we would omit endsAt for a resolved alert.
    const isResolved =
      alertState === GrafanaAlertState.Normal || (alertState == null && Boolean(alertEndsAt) && !alertStartsAt);
    const status = isResolved ? 'resolved' : 'firing';
    const generatorURL = rule?.uid ? createAbsoluteUrl(`/alerting/grafana/${rule.uid}/view`) : undefined;
    // Prefer state-history resolve time; fall back to now so Assistant always gets
    // a non-zero endsAt for resolved alerts (required for downstream context).
    const endsAt = isResolved ? (alertEndsAt ?? new Date().toISOString()) : undefined;

    try {
      const result = await startInvestigation({
        ...requestBody,
        name: rule?.title,
        alerts: requestBody.alerts.map((alert) => ({
          ...alert,
          ...(alertStartsAt ? { startsAt: alertStartsAt } : {}),
          ...(endsAt ? { endsAt } : {}),
          status,
          generatorURL,
        })),
      }).unwrap();
      trackAssistantInvestigationStartSucceeded({
        from_status: fromStatus,
        investigation_id: result.id,
      });
    } catch {
      trackAssistantInvestigationStartFailed({ from_status: fromStatus });
    }
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
    return {
      status: 'lookupError',
      onRetry: () => {
        trackAssistantInvestigationRetry({ retry_type: 'lookup', from_status: 'lookupError' });
        refetchLookup();
      },
    };
  }

  if (investigation && isAssistantInvestigationCompleted(investigation.state)) {
    return {
      status: 'completed',
      href: getAssistantInvestigationUrl(investigation.id),
      investigationId: investigation.id,
      onOpenReport: () =>
        trackAssistantInvestigationOpenReport({
          from_status: 'completed',
          investigation_id: investigation.id,
        }),
    };
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
      investigationId: investigation.id,
      onStart: createOnStart('reportFailed'),
      onOpenReport: () =>
        trackAssistantInvestigationOpenReport({
          from_status: 'reportFailed',
          investigation_id: investigation.id,
        }),
    };
  }

  if (isStartError) {
    return { status: 'startError', onStart: createOnStart('startError') };
  }

  if (isPollError && knownId && !isAssistantInvestigationTerminal(investigation?.state)) {
    return {
      status: 'pollError',
      href: getAssistantInvestigationUrl(knownId),
      investigationId: knownId,
      onRetry: () => {
        trackAssistantInvestigationRetry({ retry_type: 'poll', from_status: 'pollError' });
        refetchPoll();
      },
      onWatchLive: () =>
        trackAssistantInvestigationWatchLive({
          from_status: 'pollError',
          investigation_id: knownId,
        }),
    };
  }

  if (investigation && !isAssistantInvestigationTerminal(investigation.state)) {
    return {
      status: 'running',
      href: getAssistantInvestigationUrl(investigation.id),
      investigationId: investigation.id,
      onWatchLive: () =>
        trackAssistantInvestigationWatchLive({
          from_status: 'running',
          investigation_id: investigation.id,
        }),
    };
  }

  return { status: 'idle', onStart: createOnStart('idle') };
}
