import { useMemo } from 'react';

import { DataQuery } from '@grafana/schema';

import { AlertRule, EMPTY_ALERT, Transformation } from '../types';

/**
 * Hook to resolve the currently selected query, transformation, or alert.
 * They are mutually exclusive - only one type can be selected at a time.
 *
 * @param hasPendingPicker - When true, suppresses the default fallback to the
 *   first query so no card appears selected while a picker (expression or
 *   transformation) is active.
 */
export function useSelectedCard(
  selectedQueryRefId: string | null,
  selectedTransformationId: string | null,
  selectedAlertId: string | null,
  queries: DataQuery[],
  transformations: Transformation[],
  alerts: AlertRule[],
  hasPendingPicker = false
) {
  const selectedQuery = useMemo(() => {
    // If we have a selected query refId, try to find that query
    if (selectedQueryRefId) {
      const query = queries.find((q) => q.refId === selectedQueryRefId);
      if (query) {
        return query;
      }
    }

    // If a transformation, alert, or picker is active, don't select any query
    if (selectedTransformationId || selectedAlertId || hasPendingPicker) {
      return null;
    }

    // Otherwise, default to the first query if available
    return queries.length > 0 ? queries[0] : null;
  }, [queries, selectedQueryRefId, selectedTransformationId, selectedAlertId, hasPendingPicker]);

  const selectedTransformation = useMemo(() => {
    // If we have a selected transformation id, try to find that transformation
    if (selectedTransformationId) {
      const transformation = transformations.find((t) => t.transformId === selectedTransformationId);
      if (transformation) {
        return transformation;
      }
    }

    return null;
  }, [transformations, selectedTransformationId]);

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
