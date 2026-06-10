import { useMemo } from 'react';

import { type DataQuery } from '@grafana/schema';

import { type AlertRule, EMPTY_ALERT, type Transformation } from '../types';

/**
 * Maps the resolved active ids from useSelectionState to the corresponding query /
 * transformation / alert objects. The ids arrive already resolved against the live lists
 * (useSelectionState falls back to queries[0] when nothing is explicitly active), so this
 * hook only applies cross-type precedence on top.
 *
 * @param hasPendingPicker - Suppresses the query card while an expression or transformation
 *   type picker is active, so the content area shows the picker instead.
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
    if (selectedAlertId || hasPendingPicker || !activeQueryRefId) {
      return null;
    }

    return queries.find(({ refId }) => refId === activeQueryRefId) ?? null;
  }, [queries, activeQueryRefId, selectedAlertId, hasPendingPicker]);

  const selectedTransformation = useMemo(() => {
    if (activeTransformationId) {
      const transformation = transformations.find(({ transformId }) => transformId === activeTransformationId);
      if (transformation) {
        return transformation;
      }
    }

    return null;
  }, [transformations, activeTransformationId]);

  const selectedAlert = useMemo(() => {
    if (selectedAlertId) {
      const alert = alerts.find(({ alertId }) => alertId === selectedAlertId);
      if (alert) {
        return alert;
      }
      if (selectedAlertId === EMPTY_ALERT.alertId) {
        return EMPTY_ALERT;
      }
    }

    return null;
  }, [alerts, selectedAlertId]);

  return { selectedQuery, selectedTransformation, selectedAlert };
}
