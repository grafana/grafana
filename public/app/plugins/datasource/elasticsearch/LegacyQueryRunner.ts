import { first as _first, cloneDeep } from 'lodash';
import { lastValueFrom, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  dateTime,
  ensureTimeField,
  Field,
  LogRowContextOptions,
  LogRowContextQueryDirection,
  LogRowModel,
} from '@grafana/data';
import { BackendSrvRequest, getBackendSrv, TemplateSrv } from '@grafana/runtime';

import { ElasticResponse } from './ElasticResponse';
import { ElasticDatasource, enhanceDataFrameWithDataLinks } from './datasource';
import { defaultBucketAgg, hasMetricOfType } from './queryDef';
import { trackQuery } from './tracking';
import { DataLinkConfig, ElasticsearchQuery, Logs } from './types';

export class LegacyQueryRunner {
  datasource: ElasticDatasource;
  templateSrv: TemplateSrv;

  constructor(datasource: ElasticDatasource, templateSrv: TemplateSrv) {
    this.datasource = datasource;
    this.templateSrv = templateSrv;
  }

  request(
    method: string,
    url: string,
    data?: BackendSrvRequest['data'],
    headers?: BackendSrvRequest['headers']
  ): Observable<any> {
    if (!this.datasource.isProxyAccess) {
      const error = new Error(
        'Browser access mode in the Elasticsearch datasource is no longer available. Switch to server access mode.'
      );
      return throwError(() => error);
    }

    const options: BackendSrvRequest = {
      url: this.datasource.url + '/' + url,
      method,
      data,
      headers,
    };

    if (method === 'POST') {
      options.headers = options.headers ?? {};
      options.headers['Content-Type'] = 'application/x-ndjson';
    }

    if (this.datasource.basicAuth || this.datasource.withCredentials) {
      options.withCredentials = true;
    }
    if (this.datasource.basicAuth) {
      options.headers = {
        Authorization: this.datasource.basicAuth,
      };
    }

    return getBackendSrv()
      .fetch<any>(options)
      .pipe(
        map((results) => {
          results.data.$$config = results.config;
          return results.data;
        }),
        catchError((err) => {
          if (err.data) {
            const message = err.data.error?.reason ?? err.data.message ?? 'Unknown error';

            return throwError({
              message,
              error: err.data.error,
            });
          }

          return throwError(err);
        })
      );
  }

  async logContextQuery(row: LogRowModel, options?: LogRowContextOptions): Promise<{ data: DataFrame[] }> {
    const sortField = row.dataFrame.fields.find((f) => f.name === 'sort');
    const searchAfter = sortField?.values[row.rowIndex] || [row.timeEpochMs];
    const sort = options?.direction === LogRowContextQueryDirection.Forward ? 'asc' : 'desc';

    const header =
      options?.direction === LogRowContextQueryDirection.Forward
        ? this.datasource.getQueryHeader('query_then_fetch', dateTime(row.timeEpochMs))
        : this.datasource.getQueryHeader('query_then_fetch', undefined, dateTime(row.timeEpochMs));

    const limit = options?.limit ?? 10;
    const esQuery = JSON.stringify({
      size: limit,
      query: {
        bool: {
          filter: [
            {
              range: {
                [this.datasource.timeField]: {
                  [options?.direction === LogRowContextQueryDirection.Forward ? 'gte' : 'lte']: row.timeEpochMs,
                  format: 'epoch_millis',
                },
              },
            },
          ],
        },
      },
      sort: [{ [this.datasource.timeField]: sort }, { _doc: sort }],
      search_after: searchAfter,
    });
    const payload = [header, esQuery].join('\n') + '\n';
    const url = this.datasource.getMultiSearchUrl();
    const response = await lastValueFrom(this.request('POST', url, payload));
    const targets: ElasticsearchQuery[] = [{ refId: `${row.dataFrame.refId}`, metrics: [{ type: 'logs', id: '1' }] }];
    const elasticResponse = new ElasticResponse(targets, transformHitsBasedOnDirection(response, sort));
    const logResponse = elasticResponse.getLogs(this.datasource.logMessageField, this.datasource.logLevelField);
    const dataFrame = _first(logResponse.data);
    if (!dataFrame) {
      return { data: [] };
    }
    /**
     * The LogRowContext requires there is a field in the dataFrame.fields
     * named `ts` for timestamp and `line` for the actual log line to display.
     * Unfortunatly these fields are hardcoded and are required for the lines to
     * be properly displayed. This code just copies the fields based on this.timeField
     * and this.logMessageField and recreates the dataFrame so it works.
     */
    const timestampField = dataFrame.fields.find((f: Field) => f.name === this.datasource.timeField);
    const lineField = dataFrame.fields.find((f: Field) => f.name === this.datasource.logMessageField);
    const otherFields = dataFrame.fields.filter((f: Field) => f !== timestampField && f !== lineField);
    if (timestampField && lineField) {
      return {
        data: [
          {
            ...dataFrame,
            fields: [ensureTimeField(timestampField), lineField, ...otherFields],
          },
        ],
      };
    }
    return logResponse;
  }

  query(request: DataQueryRequest<ElasticsearchQuery>): Observable<DataQueryResponse> {
    let payload = '';
    const targets = this.datasource.interpolateVariablesInQueries(cloneDeep(request.targets), request.scopedVars);
    const sentTargets: ElasticsearchQuery[] = [];
    let targetsContainsLogsQuery = targets.some((target) => hasMetricOfType(target, 'logs'));

    const logLimits: Array<number | undefined> = [];

    for (const target of targets) {
      if (target.hide) {
        continue;
      }

      let queryObj;
      if (hasMetricOfType(target, 'logs')) {
        // FIXME: All this logic here should be in the query builder.
        // When moving to the BE-only implementation we should remove this and let the BE
        // Handle this.
        // TODO: defaultBucketAgg creates a dete_histogram aggregation without a field, so it fallbacks to
        // the configured timeField. we should allow people to use a different time field here.
        target.bucketAggs = [defaultBucketAgg()];

        const log = target.metrics?.find((m) => m.type === 'logs') as Logs;
        const limit = log.settings?.limit ? parseInt(log.settings?.limit, 10) : 500;
        logLimits.push(limit);

        target.metrics = [];
        // Setting this for metrics queries that are typed as logs
        queryObj = this.datasource.queryBuilder.getLogsQuery(target, limit);
      } else {
        logLimits.push();
        if (target.alias) {
          target.alias = this.datasource.interpolateLuceneQuery(target.alias, request.scopedVars);
        }

        queryObj = this.datasource.queryBuilder.build(target);
      }

      const esQuery = JSON.stringify(queryObj);

      const searchType = 'query_then_fetch';
      const header = this.datasource.getQueryHeader(searchType, request.range.from, request.range.to);
      payload += header + '\n';

      payload += esQuery + '\n';

      sentTargets.push(target);
    }

    if (sentTargets.length === 0) {
      return of({ data: [] });
    }

    // We replace the range here for actual values. We need to replace it together with enclosing "" so that we replace
    // it as an integer not as string with digits. This is because elastic will convert the string only if the time
    // field is specified as type date (which probably should) but can also be specified as integer (millisecond epoch)
    // and then sending string will error out.
    payload = payload.replace(/"\$timeFrom"/g, request.range.from.valueOf().toString());
    payload = payload.replace(/"\$timeTo"/g, request.range.to.valueOf().toString());
    payload = this.templateSrv.replace(payload, request.scopedVars);

    const url = this.datasource.getMultiSearchUrl();

    const start = new Date();
    return this.request('POST', url, payload).pipe(
      map((res) => {
        const er = new ElasticResponse(sentTargets, res);

        // TODO: This needs to be revisited, it seems wrong to process ALL the sent queries as logs if only one of them was a log query
        if (targetsContainsLogsQuery) {
          const response = er.getLogs(this.datasource.logMessageField, this.datasource.logLevelField);

          response.data.forEach((dataFrame, index) => {
            enhanceDataFrame(dataFrame, this.datasource.dataLinks, logLimits[index]);
          });
          return response;
        }

        return er.getTimeSeries();
      }),
      tap((response) => trackQuery(response, request, start))
    );
  }
}

function transformHitsBasedOnDirection(response: any, direction: 'asc' | 'desc') {
  if (direction === 'desc') {
    return response;
  }
  const actualResponse = response.responses[0];
  return {
    ...response,
    responses: [
      {
        ...actualResponse,
        hits: {
          ...actualResponse.hits,
          hits: actualResponse.hits.hits.reverse(),
        },
      },
    ],
  };
}

/**
 * Modifies dataFrame and adds dataLinks from the config.
 * Exported for tests.
 */
export function enhanceDataFrame(dataFrame: DataFrame, dataLinks: DataLinkConfig[], limit?: number) {
  if (limit) {
    dataFrame.meta = {
      ...dataFrame.meta,
      limit,
    };
  }
  enhanceDataFrameWithDataLinks(dataFrame, dataLinks);
}
