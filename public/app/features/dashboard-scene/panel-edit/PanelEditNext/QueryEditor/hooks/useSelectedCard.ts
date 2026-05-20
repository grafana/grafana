import { useMemo } from 'react';

import { type DataQuery } from '@grafana/schema';

import { type AlertRule, EMPTY_ALERT, type Transformation } from '../types';

/**
 * Resolves the highlighted query, transformation, and alert from the current
 * highlight state.
 *
 * Each type tracks its own `highlightedId` (a single value). This hook turns
 * those ids into the corresponding full objects from `queries` /
 * `transformations` / `alerts`. Cross-type exclusivity is enforced upstream
 * by the selection state hook, so at most one of the three is non-null.
 *
 * Query highlight has an auto-select fallback: when nothing is explicitly
 * highlighted and no other type or picker is active, it defaults to queries[0]
 * so the editor pane is never empty. If the highlighted query is deleted, its
 * refId is no longer found and the fallback kicks in.
 *
 * @param hasPendingPicker - Suppresses the query auto-select fallback while
 *   an expression or transformation type picker is active, so the content
 *   area shows the picker instead.
 */
export function useSelectedCard(
  highlightedQueryRefId: string | null,
  highlightedTransformationId: string | null,
  highlightedAlertId: string | null,
  queries: DataQuery[],
  transformations: Transformation[],
  alerts: AlertRule[],
  hasPendingPicker = false
) {
  const highlightedQuery = useMemo(() => {
    // Alert or picker takes precedence — short-circuit before resolving the
    // highlighted query so the alert/picker view always wins, even when
    // `highlightedQueryRefId` is non-null (e.g. after `clearSelection`
    // restores the first-query default).
    if (highlightedAlertId || hasPendingPicker) {
      return null;
    }

    if (highlightedQueryRefId) {
      const query = queries.find(({ refId }) => refId === highlightedQueryRefId);
      if (query) {
        return query;
      }
    }

    // If a transformation is highlighted, don't fall back to the first query.
    if (highlightedTransformationId) {
      return null;
    }

    return queries.length > 0 ? queries[0] : null;
  }, [queries, highlightedQueryRefId, highlightedTransformationId, highlightedAlertId, hasPendingPicker]);

  const highlightedTransformation = useMemo(() => {
    if (highlightedTransformationId) {
      const transformation = transformations.find(({ transformId }) => transformId === highlightedTransformationId);
      if (transformation) {
        return transformation;
      }
    }

    return null;
  }, [transformations, highlightedTransformationId]);

  const highlightedAlert = useMemo(() => {
    if (highlightedAlertId) {
      const alert = alerts.find(({ alertId }) => alertId === highlightedAlertId);
      if (alert) {
        return alert;
      }
      // Handle empty alert case when viewing alerts with no alerts
      if (highlightedAlertId === EMPTY_ALERT.alertId) {
        return EMPTY_ALERT;
      }
    }

    return null;
  }, [alerts, highlightedAlertId]);

  return {
    highlightedQuery,
    highlightedTransformation,
    highlightedAlert,
    primaryQueryRefId: highlightedQuery?.refId ?? null,
  };
}
