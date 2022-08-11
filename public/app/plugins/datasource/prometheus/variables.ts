import { from, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  DataQueryRequest,
  DataQueryResponse,
  rangeUtil,
  StandardVariableQuery,
  StandardVariableSupport,
} from '@grafana/data';
import { getTemplateSrv, TemplateSrv } from '@grafana/runtime';

import { getTimeSrv, TimeSrv } from '../../../features/dashboard/services/TimeSrv';

import { PrometheusDatasource } from './datasource';
import PrometheusMetricFindQuery from './metric_find_query';
import { PromQuery } from './types';

export class PrometheusVariableSupport extends StandardVariableSupport<PrometheusDatasource> {
  constructor(
    private readonly datasource: PrometheusDatasource,
    private readonly templateSrv: TemplateSrv = getTemplateSrv(),
    private readonly timeSrv: TimeSrv = getTimeSrv()
  ) {
    super();
    this.query = this.query.bind(this);
  }

  query(request: DataQueryRequest<PromQuery>): Observable<DataQueryResponse> {
    const query = request.targets[0].expr;
    if (!query) {
      return of({ data: [] });
    }

    const scopedVars = {
      ...request.scopedVars,
      __interval: { text: this.datasource.interval, value: this.datasource.interval },
      __interval_ms: {
        text: rangeUtil.intervalToMs(this.datasource.interval),
        value: rangeUtil.intervalToMs(this.datasource.interval),
      },
      ...this.datasource.getRangeScopedVars(this.timeSrv.timeRange()),
    };

    const interpolated = this.templateSrv.replace(query, scopedVars, this.datasource.interpolateQueryExpr);
    const metricFindQuery = new PrometheusMetricFindQuery(this.datasource, interpolated);
    const metricFindStream = from(metricFindQuery.process());

    return metricFindStream.pipe(map((results) => ({ data: results })));
  }

  toDataQuery(query: StandardVariableQuery): PromQuery {
    return {
      refId: 'PrometheusDatasource-VariableQuery',
      expr: query.query,
    };
  }
}
