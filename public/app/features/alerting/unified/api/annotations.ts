import { getBackendSrv } from '@grafana/runtime';
import { StateHistoryItem } from 'app/types/unified-alerting';

export function fetchAnnotations(alertId: string): Promise<StateHistoryItem[]> {
  return getBackendSrv()
    .get('/api/annotations', {
      alertId,
    })
    .then((result) => {
      return result?.sort(sortStateHistory);
    });
}

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
