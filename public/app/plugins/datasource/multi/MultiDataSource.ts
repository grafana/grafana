import { Observable } from 'rxjs';

import {
  DataSourceApi,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
} from '@grafana/data';
import { MixedDatasource } from '../mixed/module';
import { MultiResolutionQuery, ResolutionSelection, QueriesForResolution } from './types';
import defaults from 'lodash/defaults';
import { rangeToIntervalMS } from '@grafana/data/src/datetime/rangeutil';

export const MULTI_DATASOURCE_NAME = '-- From Time --';

export function nextId() {
  const rand = Math.random().toString(36); // '0.xtis06h6'
  if (rand.length > 9) {
    return rand.substr(2, 9);
  }
  return rand;
}

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
        id: nextId(),
        ms: 0,
        targets: [{ refId: 'A' }],
      },
    ];
  } else {
    q.resolutions[0].ms = 0;
  }
  return q;
}

export function getQueriesForResolution(
  q: MultiResolutionQuery,
  request?: DataQueryRequest
): { query: QueriesForResolution; index: number; time: number } {
  if (!q || !q.resolutions || !q.resolutions.length) {
    return {
      query: {
        id: nextId(),
        ms: Number.NEGATIVE_INFINITY,
        targets: [], // nothing
      },
      index: -1,
      time: 0,
    };
  }
  let index = 0;
  let query = q.resolutions[0];
  let time = 0;
  const len = q.resolutions.length;
  if (len > 0 && request) {
    const isNow = request.range.raw.to === 'now';
    time = q.select === ResolutionSelection.interval ? request.intervalMs : rangeToIntervalMS(request.range);
    for (let i = 1; i < len; i++) {
      const res = q.resolutions[i];
      if (res.ms > time) {
        // equal lets it use the value
        break;
      }
      if (res.now && !isNow) {
        continue; // Don't use this value and check the next one
      }
      query = res;
      index = i;
    }
  }
  return { query, index, time };
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
