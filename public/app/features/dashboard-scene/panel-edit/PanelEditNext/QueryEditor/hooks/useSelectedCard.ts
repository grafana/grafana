import { useMemo } from 'react';

import { type DataQuery } from '@grafana/schema';

import { type AlertRule, EMPTY_ALERT, type Transformation } from '../types';

/**
 * Resolves `selectedQuery`, `selectedTransformation`, and `selectedAlert` from active
 * selection ids and the live Scene query/transformation lists.
 *
 * Query selection has an auto-select fallback: when no active query is set and no other
 * type or picker is active, it defaults to queries[0] so the editor pane is never empty.
 * If the active query is deleted, its refId is no longer found and the fallback kicks in.
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
    if (selectedAlertId || hasPendingPicker) {
      return null;
    }

    if (activeQueryRefId) {
      const query = queries.find(({ refId }) => refId === activeQueryRefId);
      if (query) {
        return query;
      }
    }

    if (activeTransformationId) {
      return null;
    }

    return queries.length > 0 ? queries[0] : null;
  }, [queries, activeQueryRefId, activeTransformationId, selectedAlertId, hasPendingPicker]);

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
