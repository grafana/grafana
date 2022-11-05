import { from, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { CustomVariableSupport, DataQueryRequest, DataQueryResponse, rangeUtil } from '@grafana/data';
import { getTemplateSrv, TemplateSrv } from '@grafana/runtime';

import { getTimeSrv, TimeSrv } from '../../../features/dashboard/services/TimeSrv';

import { PromVariableQueryEditor } from './components/VariableQueryEditor';
import { PrometheusDatasource } from './datasource';
import PrometheusMetricFindQuery from './metric_find_query';
import { PromQuery } from './types';

export class PrometheusVariableSupport extends CustomVariableSupport<PrometheusDatasource> {
  constructor(
    private readonly datasource: PrometheusDatasource,
    private readonly templateSrv: TemplateSrv = getTemplateSrv(),
    private readonly timeSrv: TimeSrv = getTimeSrv()
  ) {
    super();
    this.query = this.query.bind(this);
  }

  editor = PromVariableQueryEditor;

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
}
