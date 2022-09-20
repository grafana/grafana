import { Observable } from 'rxjs';

import { DataQueryResponse, MutableDataFrame, FieldType } from '@grafana/data';

import { AzureMonitorQuery } from '../../types';
import { routeNames } from '../../utils/common';

export default class QueryBuilder {
  resourcePath: string;
  operationId: string;
  traceQuery: string;
  resourceName: string;
  query: AzureMonitorQuery;

  constructor(operationId: string, query: AzureMonitorQuery) {
    this.resourcePath = `${routeNames.logAnalytics};`;
    this.operationId = operationId ?? '';
    this.traceQuery = '';
    this.query = query;

    const uriSplit = this.query.azureLogAnalytics?.resource?.split('/') ?? [];
    this.resourceName = uriSplit[uriSplit.length - 1] ?? '';
  }

  buildTraceQuery(): AzureMonitorQuery {
    if (!this.resourceName || this.resourceName === '') {
      return { ...this.query };
    }
    const queryString = `union *, 
        app('${this.resourceName.toLowerCase()}').traces, app('${this.resourceName.toLowerCase()}').customEvents, 
        app('${this.resourceName.toLowerCase()}').pageViews, app('${this.resourceName.toLowerCase()}').requests, 
        app('${this.resourceName.toLowerCase()}').dependencies, app('${this.resourceName.toLowerCase()}').exceptions, 
        app('${this.resourceName.toLowerCase()}').customMetrics, app('${this.resourceName.toLowerCase()}').availabilityResults
        | where timestamp > $__timeFrom and timestamp < $__timeTo
        | where operation_Id == ${this.operationId}`;

    return {
      ...this.query,
      azureLogAnalytics: {
        ...this.query.azureLogAnalytics,
        query: queryString,
      },
    };
  }

  // convertResponseToTrace(responses: any): Observable<DataQueryResponse> {
  //     return responses.map((response: any) => {
  //         return {
  //           data: [
  //             new MutableDataFrame({
  //               fields: [
  //                 {
  //                   name: 'trace',
  //                   type: FieldType.trace,
  //                   values: response?.data?.data || [],
  //                 },
  //               ],
  //               meta: {
  //                 preferredVisualisationType: 'trace',
  //               },
  //             }),
  //           ],
  //         };
  //       })
  // }
}
