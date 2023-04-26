import { from, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { CustomVariableSupport, DataQueryRequest, DataQueryResponse, rangeUtil } from '@grafana/data';
import { getTemplateSrv, TemplateSrv } from '@grafana/runtime';

import { getTimeSrv, TimeSrv } from '../../../features/dashboard/services/TimeSrv';

import { PromVariableQueryEditor } from './components/VariableQueryEditor';
import { PrometheusDatasource } from './datasource';
import PrometheusMetricFindQuery from './metric_find_query';
import { PromVariableQuery } from './types';

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

  query(request: DataQueryRequest<PromVariableQuery>): Observable<DataQueryResponse> {
    // Handling grafana as code from jsonnet variable queries which are strings and not objects
    // Previously, when using StandardVariableSupport
    // the variable query string was changed to be on the expr attribute
    // Now, using CustomVariableSupport,
    // the variable query is changed to the query attribute.
    // So, without standard variable support changing the query string to the expr attribute,
    // the variable query string is coming in as it is written in jsonnet,
    // where it is just a string. Here is where we handle that.
    let query: string | undefined;
    if (typeof request.targets[0] === 'string') {
      query = request.targets[0];
    } else {
      query = request.targets[0].query;
    }

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
