import { useMemo } from 'react';

import { type DataQuery } from '@grafana/schema';

import { type AlertRule, EMPTY_ALERT, type Transformation } from '../types';

/**
 * Resolves the primary selected query, transformation, and alert from the current selection state.
 *
 * "Primary" means the last element of the respective selection array — the most recently
 * touched item, which is shown in the editor pane. See useSelectionState for the ordering rules.
 *
 * Query selection has an auto-select fallback: when nothing is explicitly selected and no other
 * type or picker is active, it defaults to queries[0] so the editor pane is never empty.
 * If a selected query is deleted, its refId is no longer found and the fallback kicks in.
 *
 * @param hasPendingPicker - Suppresses the query auto-select fallback while an expression or
 *   transformation type picker is active, so the content area shows the picker instead.
 */
export function useSelectedCard(
  selectedQueryRefIds: readonly string[],
  selectedTransformationIds: readonly string[],
  selectedAlertId: string | null,
  queries: DataQuery[],
  transformations: Transformation[],
  alerts: AlertRule[],
  hasPendingPicker = false
) {
  const primaryQueryRefId = selectedQueryRefIds.at(-1) ?? null;
  const primaryTransformationId = selectedTransformationIds.at(-1) ?? null;

  const selectedQuery = useMemo(() => {
    // If we have a selected query refId, try to find that query
    if (primaryQueryRefId) {
      const query = queries.find(({ refId }) => refId === primaryQueryRefId);
      if (query) {
        return query;
      }
    }

    // If a transformation, alert, or picker is active, don't select any query
    if (primaryTransformationId || selectedAlertId || hasPendingPicker) {
      return null;
    }

    // Otherwise, default to the first query if available
    return queries.length > 0 ? queries[0] : null;
  }, [queries, primaryQueryRefId, primaryTransformationId, selectedAlertId, hasPendingPicker]);

  const selectedTransformation = useMemo(() => {
    // If we have a selected transformation id, try to find that transformation
    if (primaryTransformationId) {
      const transformation = transformations.find(({ transformId }) => transformId === primaryTransformationId);
      if (transformation) {
        return transformation;
      }
    }

    return null;
  }, [transformations, primaryTransformationId]);

  const selectedAlert = useMemo(() => {
    // If we have a selected alert id, try to find that alert
    if (selectedAlertId) {
      const alert = alerts.find(({ alertId }) => alertId === selectedAlertId);
      if (alert) {
        return alert;
      }
      // Handle empty alert case when viewing alerts with no alerts
      if (selectedAlertId === EMPTY_ALERT.alertId) {
        return EMPTY_ALERT;
      }
    }

    return null;
  }, [alerts, selectedAlertId]);

  return { selectedQuery, selectedTransformation, selectedAlert, primaryQueryRefId };
}
