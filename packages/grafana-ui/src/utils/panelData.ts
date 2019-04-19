import { PanelData } from '../types/panel';
import { DataQueryRequest, LoadingState } from '../types/index';

/**
 * Get a version of the PanelData limited to the query we are looking at
 */
export function filterPanelDataToQuery(data: PanelData, refId: string): PanelData {
  let state = data.state;
  let request = data.request;
  const series = data.series.filter(series => series.refId === refId);

  // For requests that have subRequests find the matching one
  if (series.length && request && request.subRequests) {
    for (const s of series) {
      // Now try to match the sub requests
      if (s.meta && s.meta.requestId) {
        const subs = request.subRequests as DataQueryRequest[];
        const sub = subs.find(r => {
          return r.requestId === s.meta!.requestId;
        });
        if (sub) {
          request = sub;
          if (sub.endTime) {
            state = LoadingState.Done;
          }
        }
      }
    }
  }

  const error = data.error && data.error.refId === refId ? data.error : undefined;
  if (error) {
    state = LoadingState.Error;
  }

  return {
    state,
    series,
    request,
    error,
  };
}

export function isSameDataQueryRequest(source: DataQueryRequest, event: DataQueryRequest): boolean {
  if (source.requestId === event.requestId) {
    return true;
  }
  if (source.subRequests) {
    // Alternativly we could force sub_requests to have the same prefix?

    for (const sub of source.subRequests) {
      return isSameDataQueryRequest(sub, event);
    }
  }
  return false;
}
