import { useMemo } from 'react';

import { DataQuery } from '@grafana/schema';

import { AlertRule, EMPTY_ALERT, Transformation } from '../types';

/**
 * Hook to resolve the currently selected query, transformation, or alert.
 * The "primary" selected card (shown in the editor pane) is the last element
 * of the respective selection array.
 *
 * @param hasPendingPicker - When true, suppresses the default fallback to the
 *   first query so no card appears selected while a picker (expression or
 *   transformation) is active.
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
  const primaryQueryRefId = selectedQueryRefIds[selectedQueryRefIds.length - 1] ?? null;
  const primaryTransformationId = selectedTransformationIds[selectedTransformationIds.length - 1] ?? null;

  const selectedQuery = useMemo(() => {
    // If we have a selected query refId, try to find that query
    if (primaryQueryRefId) {
      const query = queries.find((q) => q.refId === primaryQueryRefId);
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
      const transformation = transformations.find((t) => t.transformId === primaryTransformationId);
      if (transformation) {
        return transformation;
      }
    }

    return null;
  }, [transformations, primaryTransformationId]);

  const selectedAlert = useMemo(() => {
    // If we have a selected alert id, try to find that alert
    if (selectedAlertId) {
      const alert = alerts.find((a) => a.alertId === selectedAlertId);
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

  return { selectedQuery, selectedTransformation, selectedAlert };
}
