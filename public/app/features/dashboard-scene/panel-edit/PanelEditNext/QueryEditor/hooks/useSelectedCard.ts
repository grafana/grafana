import { useMemo } from 'react';

import { type DataQuery } from '@grafana/schema';

import { type AlertRule, EMPTY_ALERT, type Transformation } from '../types';

/**
 * Resolves the active query, transformation, and alert for the editor pane.
 *
 * Active query selection has an auto-select fallback: when nothing is explicitly selected and no other
 * type or picker is active, it defaults to queries[0] so the editor pane is never empty.
 * If a selected query is deleted, its refId is no longer found and the fallback kicks in.
 *
 * @param hasPendingPicker - Suppresses the query auto-select fallback while an expression or
 *   transformation type picker is active, so the content area shows the picker instead.
 */
export function useSelectedCard(
  activeQueryRefId: string | null,
  activeTransformationId: string | null,
  selectedAlertId: string | null,
  queries: DataQuery[],
  transformations: Transformation[],
  alerts: AlertRule[],
  hasPendingPicker = false
) {
  const selectedQuery = useMemo(() => {
    // Alert or picker takes precedence so the alert/picker view always wins.
    if (selectedAlertId || hasPendingPicker) {
      return null;
    }

    // If we have a selected query refId, try to find that query
    if (activeQueryRefId) {
      const query = queries.find(({ refId }) => refId === activeQueryRefId);
      if (query) {
        return query;
      }
    }

    // If a transformation is active, don't fall back to the first query.
    if (activeTransformationId) {
      return null;
    }

    // Otherwise, default to the first query if available
    return queries.length > 0 ? queries[0] : null;
  }, [queries, activeQueryRefId, activeTransformationId, selectedAlertId, hasPendingPicker]);

  const selectedTransformation = useMemo(() => {
    // If we have a selected transformation id, try to find that transformation
    if (activeTransformationId) {
      const transformation = transformations.find(({ transformId }) => transformId === activeTransformationId);
      if (transformation) {
        return transformation;
      }
    }

    return null;
  }, [transformations, activeTransformationId]);

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

  return { selectedQuery, selectedTransformation, selectedAlert, primaryQueryRefId: activeQueryRefId };
}
