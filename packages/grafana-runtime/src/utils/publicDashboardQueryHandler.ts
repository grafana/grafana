import { catchError, Observable, of, switchMap } from 'rxjs';

import { DataQuery, DataQueryRequest, DataQueryResponse } from '@grafana/data';

import { config } from '../config';
import { getBackendSrv } from '../services/backendSrv';

import { BackendDataSourceResponse, toDataQueryResponse } from './queryResponse';

export function publicDashboardQueryHandler(request: DataQueryRequest<DataQuery>): Observable<DataQueryResponse> {
  const {
    intervalMs,
    maxDataPoints,
    requestId,
    panelId,
    queryCachingTTL,
    range: { from: fromRange, to: toRange },
  } = request;
  // Return early if no queries exist
  if (!request.targets.length) {
    return of({ data: [] });
  }

  const body = {
    intervalMs,
    maxDataPoints,
    queryCachingTTL,
    timeRange: {
      from: fromRange.valueOf().toString(),
      to: toRange.valueOf().toString(),
      timezone: request.timezone,
    },
  };

  return getBackendSrv()
    .fetch<BackendDataSourceResponse>({
      url: `/api/public/dashboards/${config.publicDashboardAccessToken!}/panels/${panelId}/query`,
      method: 'POST',
      data: body,
      requestId,
    })
    .pipe(
      switchMap((raw) => {
        return of(toDataQueryResponse(raw, request.targets));
      }),
      catchError((err) => {
        return of(toDataQueryResponse(err));
      })
    );
}
