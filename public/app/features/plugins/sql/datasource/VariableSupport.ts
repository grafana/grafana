import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  DataQueryRequest,
  DataQueryResponse,
  StandardVariableSupport,
  StandardVariableQuery,
  isDataFrame,
  DataQueryResponseData,
} from '@grafana/data';

import { ResponseParser } from '../ResponseParser';
import { SQLQuery, QueryFormat } from '../types';

import { SqlDatasource } from './SqlDatasource';

export class VariableSupport extends StandardVariableSupport<SqlDatasource> {
  ds: SqlDatasource;

  constructor(ds: SqlDatasource) {
    super();
    this.toDataQuery = this.toDataQuery.bind(this);
    this.query = this.query.bind(this);
    this.ds = ds;
  }

  toDataQuery(varQuery: StandardVariableQuery): SQLQuery {
    const { query, ...rest } = varQuery;

    return {
      ...rest,
      rawSql: query,
      format: QueryFormat.Table,
    };
  }

  query(request: DataQueryRequest<SQLQuery>): Observable<DataQueryResponse> {
    return this.ds.query(request).pipe(
      map((response) => {
        const { data, ...rest } = response;

        const frame = data[0]; // we only handle the first frame

        const parser = new ResponseParser();

        const values = frame != null && isDataFrame(frame) ? parser.transformMetricFindResponse(frame) : [];

        // the typing is not great here, DataQueryResponseData basically collapses to `any`,
        // so we can store anything in it. we rely on the fact that generic Grafana code,
        // when analyzing this result, has a check to see if the result is already `MetricFindValue[]`,
        // and uses it.
        const newData: DataQueryResponseData[] = values;

        return {
          ...rest,
          data: newData,
        };
      })
    );
  }
}
