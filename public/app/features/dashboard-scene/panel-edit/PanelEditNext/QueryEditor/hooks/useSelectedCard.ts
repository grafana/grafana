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
  anchorQueryRefId: string | null,
  anchorTransformationId: string | null,
  anchorAlertId: string | null,
  queries: DataQuery[],
  transformations: Transformation[],
  alerts: AlertRule[],
  hasPendingPicker = false
) {
  const selectedQuery = useMemo(() => {
    // Alert or picker takes precedence — short-circuit before resolving the
    // highlighted query so the alert/picker view always wins, even when
    // `anchorQueryRefId` is non-null (e.g. after `clearSelection`
    // restores the first-query default).
    if (anchorAlertId || hasPendingPicker) {
      return null;
    }

    if (anchorQueryRefId) {
      const query = queries.find(({ refId }) => refId === anchorQueryRefId);
      if (query) {
        return query;
      }
    }

    // If a transformation is highlighted, don't fall back to the first query.
    if (anchorTransformationId) {
      return null;
    }

    return queries.length > 0 ? queries[0] : null;
  }, [queries, anchorQueryRefId, anchorTransformationId, anchorAlertId, hasPendingPicker]);

  const selectedTransformation = useMemo(() => {
    if (anchorTransformationId) {
      const transformation = transformations.find(({ transformId }) => transformId === anchorTransformationId);
      if (transformation) {
        return transformation;
      }
    }

    return null;
  }, [transformations, anchorTransformationId]);

  const selectedAlert = useMemo(() => {
    if (anchorAlertId) {
      const alert = alerts.find(({ alertId }) => alertId === anchorAlertId);
      if (alert) {
        return alert;
      }
      // Handle empty alert case when viewing alerts with no alerts
      if (anchorAlertId === EMPTY_ALERT.alertId) {
        return EMPTY_ALERT;
      }
    }

    return null;
  }, [alerts, anchorAlertId]);

  return {
    selectedQuery,
    selectedTransformation,
    selectedAlert,
    primaryQueryRefId: selectedQuery?.refId ?? null,
  };
}
