import { getBackendSrv } from '@grafana/runtime';
import { StateHistoryItem } from 'app/types/unified-alerting';

// LOGZ.IO GRAFANA CHANGE :: DEV-31760 - Retrieve annotations for migrated unified alerts
export function fetchAnnotations(alertId: string, oldAlertId = ''): Promise<StateHistoryItem[]> {
  const maxAnnotationToReturn = 100

  const fetchUalertAnnotationsPromise = getBackendSrv()
    .get('/api/annotations', {
      alertId,
      'type': 'unified_alert_rule'
    });

  if (oldAlertId === '' || alertId === oldAlertId) {
    return fetchUalertAnnotationsPromise.then((result) => {
      return result?.sort(sortStateHistory);
    });
  } else {
    const fetchOldAlertAnnotationsPromise = getBackendSrv()
      .get('/api/annotations', {
        'alertId': oldAlertId,
        'type': 'alert'
      })

    return Promise.all([fetchUalertAnnotationsPromise, fetchOldAlertAnnotationsPromise])
      .then((results) => {
        return results?.flatMap((item) => item).sort(sortStateHistory).slice(0, maxAnnotationToReturn);
      })
  }
}
// LOGZ.IO GRAFANA CHANGE :: end

export function sortStateHistory(a: StateHistoryItem, b: StateHistoryItem): number {
  const compareDesc = (a: number, b: number): number => {
    // Larger numbers first.
    if (a > b) {
      return -1;
    }

    if (b > a) {
      return 1;
    }
    return 0;
  };

  const endNeq = compareDesc(a.timeEnd, b.timeEnd);
  if (endNeq) {
    return endNeq;
  }

  const timeNeq = compareDesc(a.time, b.time);
  if (timeNeq) {
    return timeNeq;
  }

  return compareDesc(a.id, b.id);
}
