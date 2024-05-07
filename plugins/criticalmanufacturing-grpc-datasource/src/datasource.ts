import {
  DataFrame,
  DataFrameView,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  MetricFindValue,
  ScopedVars,
  SelectableValue,
} from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime';
import {
  Dimension,
  ListDimensionKeysQuery,
  ListDimensionValuesQuery,
  ListMetricsQuery,
  ListDatasetsQuery,
  Metadata,
  Metric,
  MyDataSourceOptions,
  NextQuery,
  QueryType,
  GetQuery,
  DatasetQuery
} from './types';
import { lastValueFrom, Observable } from 'rxjs';
import { map, mergeMap, toArray } from 'rxjs/operators';
import { getRequestLooper, MultiRequestTracker } from './requestLooper';
import { appendMatchingFrames } from './appendFrames';

export class DataSource extends DataSourceWithBackend<DatasetQuery, MyDataSourceOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
  }

  query(request: DataQueryRequest<GetQuery>): Observable<DataQueryResponse> {
    return getRequestLooper(request, {
      // Check for a "nextToken" in the response
      getNextQueries: (rsp: DataQueryResponse) => {
        if (rsp.data?.length) {
          const next: NextQuery[] = [];
          for (const frame of rsp.data as DataFrame[]) {
            const meta = frame.meta?.custom as Metadata;
            if (meta && meta.nextToken) {
              const query = request.targets.find((t) => t.refId === frame.refId);
              if (query) {
                next.push({
                  ...query,
                  nextToken: meta.nextToken,
                });
              }
            }
          }
          if (next.length) {
            return next;
          }
        }
        return undefined;
      },
      /**
       * The original request
       */
      query: (request: DataQueryRequest<GetQuery>) => {
        return super.query(request);
      },

      /**
       * Process the results
       */
      process: (t: MultiRequestTracker, data: DataFrame[], _isLast: boolean) => {
        if (t.data) {
          // append rows to fields with the same structure
          t.data = appendMatchingFrames(t.data, data);
        } else {
          t.data = data; // hang on to the results from the last query
        }
        return t.data;
      },

      /**
       * Callback that gets executed when unsubscribed
       */
      onCancel: (_tracker: MultiRequestTracker) => { },
    });
  }

  formatMetric(metric: Metric): string {
    return metric.metricId || '';
  }

  formatDimension(dim: Dimension): string {
    return `${dim.key}=${dim.value}`;
  }

  getQueryDisplayText(query: GetQuery): string {
    let displayText = '[' + query.dimensions?.map(this.formatDimension).join(',') + ']';

    if (query.metrics && query.metrics?.length > 0) {
      displayText += ' ' + query.metrics.map(this.formatMetric).join('&');
    }
    return displayText || query.refId;
  }

  /**
   * Supports lists of metrics
   */
  async metricFindQuery(query: any, options?: any): Promise<MetricFindValue[]> {
    // List Dimension Values
    const dimensionKey: string = query.dimensionKey;
    const dataset: string = query.dataset;
    let filtersJson: string = '';

    query = this.applyTemplateVariables(query, options.scopedVars);

    if (query.dimensions?.length > 0) {

      query.dimensions.forEach((dimension: Dimension) => {
        filtersJson += '"' + this.escapeJson(dimension.key) + '":"' + this.escapeJson(dimension.value?.toString()) + '",';
      });

      // remove the last ","
      filtersJson = "{" + filtersJson.slice(0, -1) + "}";
    }

    const dimensionValues = await this.listDimensionValues(dimensionKey, filtersJson, dataset, false);

    return dimensionValues.map((x) => ({ text: x.value || '' }));
  }

  /**
   * Escapes special characters in a JSON string
   */
  escapeJson(string: string | undefined): string {
    if (string != undefined) {
      return string
        .replace(/[\\]/g, '\\\\')
        .replace(/[\"]/g, '\\\"')
        .replace(/[\/]/g, '\\/')
        .replace(/[\b]/g, '\\b')
        .replace(/[\f]/g, '\\f')
        .replace(/[\n]/g, '\\n')
        .replace(/[\r]/g, '\\r')
        .replace(/[\t]/g, '\\t');
    } else {
      return '';
    }
  }

  applyTemplateVariables(query: GetQuery, scopedVars: ScopedVars): GetQuery {
    const templateSrv = getTemplateSrv();

    let replacedMaxItems: number | undefined;

    if (query.maxItems != undefined) {
      if (typeof query.maxItems === 'string' && query.maxItems?.startsWith("$")) {
        replacedMaxItems = +templateSrv.replace(query.maxItems, scopedVars);
      } else {
        replacedMaxItems = +query.maxItems;
      }
    }

    const dimensions = query.dimensions?.map((dimension) => {
      return {
        id: dimension.id,
        key: dimension.key,
        value: templateSrv.replace(dimension.value?.toString(), scopedVars, 'text').split(' + '),
        operator: dimension.operator,
      };
    });

    return {
      ...query,
      dimensions: dimensions || [],
      maxItems: replacedMaxItems
    };
  }

  runQuery(query: DatasetQuery, maxDataPoints?: number): Observable<DataQueryResponse> {
    return this.query({
      targets: [query],
      requestId: `iot.${counter++}`,
      maxDataPoints,
    } as DataQueryRequest<GetQuery>);
  }

  listDimensionKeys(datasetName: string): Promise<Array<SelectableValue<string>>> {
    const query: ListDimensionKeysQuery = {
      refId: 'listDimensionKeys',
      queryType: QueryType.ListDimensionKeys,
      dataset: datasetName
    };
    const dimKeys = this.runQuery(query).pipe(
      map((res) => {
        if (res.data.length) {
          const dimensions = new DataFrameView<SelectableValue<string>>(res.data[0]);
          return dimensions.toArray();
        }
        throw `no dimensions found ${res.error}`;
      })
    );
    return lastValueFrom(dimKeys);
  }

  listDimensionValues(key: string, filter: string, datasetName: string, includeVariables?: boolean): Promise<Array<SelectableValue<string>>> {
    const query: ListDimensionValuesQuery = {
      refId: 'listDimensionValues',
      queryType: QueryType.ListDimensionValues,
      dimensionKey: key,
      filter: filter,
      dataset: datasetName
    };

    const dimValues = this.runQuery(query).pipe(
      map((res) => {
        if (res.data.length) {
          const dimensionValues = new DataFrameView<SelectableValue<string>>(res.data[0]);
          if (includeVariables) {

            const variables: SelectableValue<string>[] = getTemplateSrv().getVariables().map((x) => ({
              label: `$${x.name}`,
              value: `$${x.name}`,
              description: ``
            }));


            return [...variables, ...dimensionValues.toArray()];
          } else {
            return dimensionValues.toArray();
          }
        }
        throw 'no dimension values found';
      })
    );
    return lastValueFrom(dimValues);
  }

  runListMetricsQuery(datasetName: string): Observable<Array<SelectableValue<string>>> {
    const query: ListMetricsQuery = {
      refId: 'listMetrics',
      queryType: QueryType.ListMetrics,
      dataset: datasetName
    };
    return this.runQuery(query).pipe(
      map((res) => {
        if (res.data.length) {
          const metrics = new DataFrameView<SelectableValue<string>>(res.data[0]);
          return metrics.toArray();
        }
        throw 'no metrics found';
      })
    );
  }

  runListDatasetsQuery(): Observable<Array<SelectableValue<string>>> {
    const query: ListDatasetsQuery = {
      refId: 'listDatasets',
      queryType: QueryType.ListDatasets
    };
    return this.runQuery(query).pipe(
      map((res) => {
        if (res.data.length) {
          const datasets = new DataFrameView<SelectableValue<string>>(res.data[0]);
          return datasets.toArray();
        }
        throw 'no datasets found';
      })
    );
  }

  listMetrics(dataset: string): Observable<Array<SelectableValue<string>>> {
    const remoteMetrics = this.runListMetricsQuery(dataset).pipe(mergeMap((x) => x.flat()));

    return remoteMetrics.pipe(toArray());
  }

  listDatasets(): Observable<Array<SelectableValue<string>>> {
    const remoteDatasets = this.runListDatasetsQuery().pipe(mergeMap((x) => x.flat()));

    return remoteDatasets.pipe(toArray());
  }
}

let counter = 1000;
