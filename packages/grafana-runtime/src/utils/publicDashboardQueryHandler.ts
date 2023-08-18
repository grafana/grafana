import { catchError, from, Observable, of, switchMap } from 'rxjs';

import { DataQuery, DataQueryRequest, DataQueryResponse, toDataFrame } from '@grafana/data';

import { config } from '../config';
import { getBackendSrv } from '../services/backendSrv';

import { BackendDataSourceResponse, toDataQueryResponse } from './queryResponse';

// Unify this a bit so we do not have duplicates
export const GRAFANA_DATASOURCE_NAME = '-- Grafana --';

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

  // Its an annotations query
  // Currently, annotations requests come in one at a time, so there will only be one target
  const target = request.targets[0];
  if (target.queryType === 'annotations') {
    if (target?.datasource?.uid === GRAFANA_DATASOURCE_NAME) {
      return from(getAnnotations(request));
    }
    return of({ data: [] });
  }

  // Its a datasource query
  else {
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
}

async function getAnnotations(request: DataQueryRequest<DataQuery>): Promise<DataQueryResponse> {
  const {
    range: { to, from },
  } = request;

  const params = {
    from: from.valueOf(),
    to: to.valueOf(),
  };

  const annotations = await getBackendSrv().get(
    `/api/public/dashboards/${config.publicDashboardAccessToken!}/annotations`,
    params
  );

  return { data: [toDataFrame(annotations)] };
}
