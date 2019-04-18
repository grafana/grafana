import { PanelData } from '../types/panel';
import { DataQueryRequest, LoadingState } from '../types/index';

/**
 * Get a version of the PanelData limited to the query we are looking at
 */
export function filterPanelDataToQuery(data: PanelData, refId: string): PanelData {
  let state = data.state;
  let request = data.request;
  const series = data.series.filter(series => series.refId === refId);

  console.log('FILTER FOR', refId, series);

  // For requests that have subRequests find the matching one
  if (request && request.subRequests) {
    for (const s of series) {
      // Now try to match the sub requests
      if (s.meta && s.meta.requestId) {
        const subs = request.subRequests as DataQueryRequest[];
        const sub = subs.find(r => {
          return r.requestId === 'x';
        });
        if (sub) {
          request = sub;
          if (sub.endTime && state === LoadingState.Loading) {
            state = LoadingState.Done;
          }
        }
      }
    }
  }
  return {
    state,
    series,
    request,
    error: data.error && data.error.refId === refId ? data.error : undefined,
  };
}
