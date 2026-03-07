import { useEffect, useRef, useState, useMemo } from 'react';

import {
  CreateNotificationqueryNotificationCount,
  generatedAPI as notificationsApi,
} from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { dateTime } from '@grafana/data';
import { dispatch } from 'app/store/store';

import { ReceiversStateDTO, NotifierStatus } from '../../types/alerting';

const ONE_HOUR_AGO = () => dateTime().subtract(1, 'hour').toISOString();
const NOW = () => dateTime().toISOString();

interface NotificationHistoryOptions {
  skip?: boolean;
  pollingInterval?: number;
}

// Composite key: "<type>:<integrationIndex>" uniquely identifies an integration within a receiver.
// The history API's integrationIndex is the 0-based occurrence of that type within the receiver,
// not the overall position in the integrations array.
type IntegrationKey = string;
const integrationKey = (type: string, index: number): IntegrationKey => `${type}:${index}`;

interface IntegrationInfo {
  integrationType: string;
  integrationIndex: number;
  successCount: number;
  failedCount: number;
  lastNotifyAttempt: string;
  lastNotifyAttemptDuration: string;
  lastNotifyAttemptError: string | null;
}

interface IntegrationCountsResult {
  // All integrations keyed by composite "type:index"
  byKey: Map<IntegrationKey, IntegrationInfo>;
}

/**
 * Custom hook to fetch notification status for multiple contact points using the counts API.
 * Makes two requests per fetch:
 * 1. A single counts query grouped by receiver, integration, integrationIndex and outcome
 * 2. One entries query per receiver (limit=100) for the most recent attempt metadata per integration
 */
export const useNotificationHistoryForContactPoints = (
  contactPointNames: string[],
  options: NotificationHistoryOptions = {}
): {
  data?: ReceiversStateDTO[];
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
} => {
  const { skip = false, pollingInterval } = options;

  const [receiverData, setReceiverData] = useState<Map<string, IntegrationCountsResult>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchNotificationStatus = async () => {
    if (skip || contactPointNames.length === 0) {
      return;
    }

    setIsLoading(true);
    setIsError(false);
    setError(undefined);

    const from = ONE_HOUR_AGO();
    const to = NOW();

    try {
      // Single counts query for all contact points, grouped by receiver, integration, integrationIndex and outcome
      const countsResponse = await dispatch(
        notificationsApi.endpoints.createNotificationquery.initiate({
          createNotificationqueryRequestBody: {
            from,
            to,
            type: 'counts',
            groupBy: {
              receiver: true,
              integration: true,
              integrationIndex: true,
              outcome: true,
              status: false,
              error: false,
            },
          },
        })
      ).unwrap();

      // One entries query per receiver to get the most recent entry per integration index
      const recentEntriesResults = await Promise.all(
        contactPointNames.map((receiverName) =>
          dispatch(
            notificationsApi.endpoints.createNotificationquery.initiate({
              createNotificationqueryRequestBody: {
                from,
                to,
                receiver: receiverName,
                limit: 100,
              },
            })
          )
            .unwrap()
            .then((res) => ({ receiverName, entries: res.entries ?? [] }))
            .catch(() => ({ receiverName, entries: [] }))
        )
      );

      const newData = new Map<string, IntegrationCountsResult>();

      for (const receiverName of contactPointNames) {
        const receiverCounts = (countsResponse.counts ?? []).filter((c) => c.receiver === receiverName);
        const entries = recentEntriesResults.find((r) => r.receiverName === receiverName)?.entries ?? [];

        const byKey = new Map<IntegrationKey, IntegrationInfo>();

        // Aggregate counts — each count row has a unique (type, integrationIndex, outcome) triple
        for (const count of receiverCounts) {
          if (!count.integration) {
            continue;
          }
          const idx = count.integrationIndex ?? 0;
          const key = integrationKey(count.integration, idx);
          const existing = byKey.get(key) ?? {
            integrationType: count.integration,
            integrationIndex: idx,
            successCount: 0,
            failedCount: 0,
            lastNotifyAttempt: '',
            lastNotifyAttemptDuration: '',
            lastNotifyAttemptError: null,
          };
          if (count.outcome === 'success') {
            existing.successCount += count.count;
          } else if (count.outcome === 'error') {
            existing.failedCount += count.count;
          }
          byKey.set(key, existing);
        }

        // Enrich with most-recent entry metadata per (type, integrationIndex)
        const sorted = [...entries].sort(
          (a, b) => dateTime(b.timestamp).valueOf() - dateTime(a.timestamp).valueOf()
        );
        for (const entry of sorted) {
          if (!entry.integration) {
            continue;
          }
          const idx = entry.integrationIndex ?? 0;
          const key = integrationKey(entry.integration, idx);
          const info = byKey.get(key);
          // Only set once (sorted desc, so first match is most recent)
          if (info && !info.lastNotifyAttempt) {
            info.lastNotifyAttempt = entry.timestamp ?? '';
            info.lastNotifyAttemptDuration =
              entry.duration != null ? `${(entry.duration / 1_000_000).toFixed(2)}ms` : '';
            info.lastNotifyAttemptError = entry.error ?? null;
          }
        }

        newData.set(receiverName, { byKey });
      }

      setReceiverData(newData);
      setIsLoading(false);
    } catch (err) {
      setIsError(true);
      setError(err);
      setIsLoading(false);
    }
  };

  // Initial fetch and polling setup
  useEffect(() => {
    if (skip) {
      return;
    }

    fetchNotificationStatus();

    if (pollingInterval) {
      pollingIntervalRef.current = setInterval(() => {
        fetchNotificationStatus();
      }, pollingInterval);
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, pollingInterval, JSON.stringify(contactPointNames)]);

  const receiversState = useMemo(() => {
    if (receiverData.size === 0) {
      return undefined;
    }

    const receivers: ReceiversStateDTO[] = [];

    receiverData.forEach((result, receiverName) => {
      const integrations = transformCountsToIntegrations(result, receiverName);
      receivers.push({
        active: true,
        integrations,
        name: receiverName,
      });
    });

    return receivers;
  }, [receiverData]);

  return {
    data: receiversState,
    isLoading,
    isError,
    error,
  };
};

/**
 * Transform aggregated counts result into a NotifierStatus array.
 * Each entry carries integrationType and integrationIndex (per-type occurrence within the receiver)
 * so that enhanceContactPointsWithMetadata can match by type + occurrence rather than overall position.
 */
export const transformCountsToIntegrations = (
  result: IntegrationCountsResult,
  receiverName: string
): NotifierStatus[] => {
  const { byKey } = result;

  if (byKey.size === 0) {
    return [
      {
        name: receiverName,
        lastNotifyAttempt: '',
        lastNotifyAttemptDuration: '',
        lastNotifyAttemptError: null,
        totalAttempts: 0,
        failedAttempts: 0,
        successAttempts: 0,
      },
    ];
  }

  return Array.from(byKey.values()).map((info) => ({
    name: receiverName,
    integrationType: info.integrationType,
    integrationIndex: info.integrationIndex,
    lastNotifyAttempt: info.lastNotifyAttempt,
    lastNotifyAttemptDuration: info.lastNotifyAttemptDuration,
    lastNotifyAttemptError: info.lastNotifyAttemptError,
    totalAttempts: info.successCount + info.failedCount,
    failedAttempts: info.failedCount,
    successAttempts: info.successCount,
  }));
};

