import { of, Observable } from 'rxjs';

import { DataSourceApi, DataQuery, DataQueryRequest, DataQueryResponse, DataSourceInstanceSettings } from '@grafana/ui';
import { MixedDatasource } from '../mixed/module';
import { MultiResolutionQuery, ResolutionSelection } from './types';
import defaults from 'lodash/defaults';
import kbn from 'app/core/utils/kbn';

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
    const res = q.resolutions.map(r => {
      // if (r.ms <= 0) {
      //   try {
      //     const ms = kbn.interval_to_ms(r.txt);
      //     if (ms) {
      //       r.ms = ms;
      //     }
      //   } catch {}
      // }
      return r;
    });
    res.sort((a, b) => {
      return a.ms - b.ms;
    });
    res[0].ms = Number.NEGATIVE_INFINITY;
    res[0].txt = '';
    q.resolutions = res;
  }
  return q;
}

export class MultiDatasource extends DataSourceApi<DataQuery> {
  // Use the mixed instance to execute queries
  mixed = new MixedDatasource({} as DataSourceInstanceSettings);

  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  query(request: DataQueryRequest<DataQuery>): Observable<DataQueryResponse> {
    const q = getMultiResolutionQuery(request.targets);

    if (q.resolutions) {
      const res = q.resolutions[0];
      return this.mixed.query({
        ...request,
        targets: res.targets,
      });
    }

    // Empty data
    return of({ data: [] } as DataQueryResponse);
  }

  testDatasource() {
    return Promise.resolve({});
  }
}
