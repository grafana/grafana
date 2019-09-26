import { Observable } from 'rxjs';

import { DataSourceApi, DataQuery, DataQueryRequest, DataQueryResponse, DataSourceInstanceSettings } from '@grafana/ui';
import { MixedDatasource } from '../mixed/module';
import { MultiResolutionQuery, ResolutionSelection, QueriesForResolution } from './types';
import defaults from 'lodash/defaults';
import { rangeToIntervalMS } from '@grafana/data/src/datetime/rangeutil';

export const MULTI_DATASOURCE_NAME = '-- From Time --';

export function isMultiResolutionQuery(datasource: string | DataSourceApi): boolean {
  if (!datasource) {
    // default datasource
    return false;
  }
  if (datasource === MULTI_DATASOURCE_NAME) {
    return true;
  }
  const ds = datasource as DataSourceApi;
  if (ds.meta) {
    // only true if it actually is DataSourceApi
    return ds.meta.name === MULTI_DATASOURCE_NAME;
  }
  return false;
}

export function getMultiResolutionQuery(queries: DataQuery[]): MultiResolutionQuery {
  const q: MultiResolutionQuery = defaults(queries ? queries[0] : {}, {
    refId: 'X', // Not really used
    select: ResolutionSelection.range,
    resolutions: [],
  }) as MultiResolutionQuery;

  // Make sure it has something
  if (!(q.resolutions && q.resolutions.length)) {
    q.resolutions = [
      {
        txt: '',
        ms: Number.NEGATIVE_INFINITY,
        targets: [{ refId: 'A' }],
      },
    ];
  } else {
    q.resolutions[0].ms = Number.NEGATIVE_INFINITY;
    q.resolutions[0].txt = '';
  }
  return q;
}

export function getQueriesForResolution(
  q: MultiResolutionQuery,
  request?: DataQueryRequest
): { query: QueriesForResolution; index: number } {
  if (!q || !q.resolutions || !q.resolutions.length) {
    return {
      query: {
        ms: Number.NEGATIVE_INFINITY,
        targets: [], // nothing
      },
      index: -1,
    };
  }
  let index = 0;
  let query = q.resolutions[0];
  const len = q.resolutions.length;
  if (len > 0 && request) {
    // Find the appropriate query range
    const cmp = q.select === ResolutionSelection.interval ? request.intervalMs : rangeToIntervalMS(request.range);

    for (let i = 1; i < len; i++) {
      if (q.resolutions[i].ms > cmp) {
        break;
      }
      query = q.resolutions[i];
      index = i;
    }
  }
  return { query, index };
}

export class MultiDatasource extends DataSourceApi<DataQuery> {
  // Use the mixed instance to execute queries
  mixed = new MixedDatasource({} as DataSourceInstanceSettings);

  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  query(request: DataQueryRequest<DataQuery>): Observable<DataQueryResponse> {
    const q = getMultiResolutionQuery(request.targets);
    const res = getQueriesForResolution(q, request).query;
    return this.mixed.query({
      ...request,
      targets: res.targets,
    });
  }

  testDatasource() {
    return Promise.resolve({});
  }
}
