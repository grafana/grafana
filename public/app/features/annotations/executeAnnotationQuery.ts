import { Observable, of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

import { CoreApp, DataQueryRequest, DataSourceApi, rangeUtil, ScopedVars } from '@grafana/data';

import { runRequest } from '../query/state/runRequest';

import { standardAnnotationSupport } from './standardAnnotationSupport';
import { AnnotationQueryOptions, AnnotationQueryResponse } from './types';

let counter = 100;
function getNextRequestId() {
  return 'AQ' + counter++;
}

export function executeAnnotationQuery(
  options: AnnotationQueryOptions,
  datasource: DataSourceApi,
  savedJsonAnno: any
): Observable<AnnotationQueryResponse> {
  const processor = {
    ...standardAnnotationSupport,
    ...datasource.annotations,
  };

  const annotation = processor.prepareAnnotation!(savedJsonAnno);
  if (!annotation) {
    return of({});
  }

  const query = processor.prepareQuery!(annotation);
  if (!query) {
    return of({});
  }

  // No more points than pixels
  const maxDataPoints = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;

  // Add interval to annotation queries
  const interval = rangeUtil.calculateInterval(options.range, maxDataPoints, datasource.interval);

  const scopedVars: ScopedVars = {
    __interval: { text: interval.interval, value: interval.interval },
    __interval_ms: { text: interval.intervalMs.toString(), value: interval.intervalMs },
    __annotation: { text: annotation.name, value: annotation },
  };

  const queryRequest: DataQueryRequest = {
    startTime: Date.now(),
    requestId: getNextRequestId(),
    range: options.range,
    maxDataPoints,
    scopedVars,
    ...interval,
    app: CoreApp.Dashboard,
    publicDashboardAccessToken: options.dashboard.meta.publicDashboardAccessToken,

    timezone: options.dashboard.timezone,

    targets: [
      {
        ...query,
        refId: 'Anno',
      },
    ],
  };

  return runRequest(datasource, queryRequest).pipe(
    mergeMap((panelData) => {
      if (!panelData.series) {
        return of({ panelData, events: [] });
      }

      return processor.processEvents!(annotation, panelData.series).pipe(map((events) => ({ panelData, events })));
    })
  );
}
