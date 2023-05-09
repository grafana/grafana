import { isNumber, isString, first as _first, cloneDeep } from 'lodash';
import { lastValueFrom, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  dateTime,
  Field,
  LogRowContextOptions,
  LogRowContextQueryDirection,
  LogRowModel,
  toUtc,
} from '@grafana/data';
import { BackendSrvRequest, getBackendSrv, TemplateSrv } from '@grafana/runtime';

import { ElasticResponse } from './ElasticResponse';
import { ElasticDatasource, enhanceDataFrame } from './datasource';
import { defaultBucketAgg, hasMetricOfType } from './queryDef';
import { trackAnnotationQuery, trackQuery } from './tracking';
import { ElasticsearchQuery, Logs } from './types';

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
              message: 'Elasticsearch error: ' + message,
              error: err.data.error,
            });
          }

          return throwError(err);
        })
      );
  }

  annotationQuery(options: any) {
    const annotation = options.annotation;
    const timeField = annotation.timeField || '@timestamp';
    const timeEndField = annotation.timeEndField || null;

    // the `target.query` is the "new" location for the query.
    // normally we would write this code as
    // try-the-new-place-then-try-the-old-place,
    // but we had the bug at
    // https://github.com/grafana/grafana/issues/61107
    // that may have stored annotations where
    // both the old and the new place are set,
    // and in that scenario the old place needs
    // to have priority.
    const queryString = annotation.query ?? annotation.target?.query;
    const tagsField = annotation.tagsField || 'tags';
    const textField = annotation.textField || null;

    const dateRanges = [];
    const rangeStart: any = {};
    rangeStart[timeField] = {
      from: options.range.from.valueOf(),
      to: options.range.to.valueOf(),
      format: 'epoch_millis',
    };
    dateRanges.push({ range: rangeStart });

    if (timeEndField) {
      const rangeEnd: any = {};
      rangeEnd[timeEndField] = {
        from: options.range.from.valueOf(),
        to: options.range.to.valueOf(),
        format: 'epoch_millis',
      };
      dateRanges.push({ range: rangeEnd });
    }

    const queryInterpolated = this.datasource.interpolateLuceneQuery(queryString);
    const query: any = {
      bool: {
        filter: [
          {
            bool: {
              should: dateRanges,
              minimum_should_match: 1,
            },
          },
        ],
      },
    };

    if (queryInterpolated) {
      query.bool.filter.push({
        query_string: {
          query: queryInterpolated,
        },
      });
    }
    const data: any = {
      query,
      size: 10000,
    };

    const header: any = {
      search_type: 'query_then_fetch',
      ignore_unavailable: true,
    };

    // @deprecated
    // Field annotation.index is deprecated and will be removed in the future
    if (annotation.index) {
      header.index = annotation.index;
    } else {
      header.index = this.datasource.indexPattern.getIndexList(options.range.from, options.range.to);
    }

    const payload = JSON.stringify(header) + '\n' + JSON.stringify(data) + '\n';

    trackAnnotationQuery(annotation);
    return lastValueFrom(
      this.request('POST', '_msearch', payload).pipe(
        map((res) => {
          const list = [];
          const hits = res.responses[0].hits.hits;

          const getFieldFromSource = (source: any, fieldName: any) => {
            if (!fieldName) {
              return;
            }

            const fieldNames = fieldName.split('.');
            let fieldValue = source;

            for (let i = 0; i < fieldNames.length; i++) {
              fieldValue = fieldValue[fieldNames[i]];
              if (!fieldValue) {
                console.log('could not find field in annotation: ', fieldName);
                return '';
              }
            }

            return fieldValue;
          };

          for (let i = 0; i < hits.length; i++) {
            const source = hits[i]._source;
            let time = getFieldFromSource(source, timeField);
            if (typeof hits[i].fields !== 'undefined') {
              const fields = hits[i].fields;
              if (isString(fields[timeField]) || isNumber(fields[timeField])) {
                time = fields[timeField];
              }
            }

            const event: {
              annotation: any;
              time: number;
              timeEnd?: number;
              text: string;
              tags: string | string[];
            } = {
              annotation: annotation,
              time: toUtc(time).valueOf(),
              text: getFieldFromSource(source, textField),
              tags: getFieldFromSource(source, tagsField),
            };

            if (timeEndField) {
              const timeEnd = getFieldFromSource(source, timeEndField);
              if (timeEnd) {
                event.timeEnd = toUtc(timeEnd).valueOf();
              }
            }

            // legacy support for title field
            if (annotation.titleField) {
              const title = getFieldFromSource(source, annotation.titleField);
              if (title) {
                event.text = title + '\n' + event.text;
              }
            }

            if (typeof event.tags === 'string') {
              event.tags = event.tags.split(',');
            }

            list.push(event);
          }
          return list;
        })
      )
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
    if (timestampField && lineField) {
      return {
        data: [
          {
            ...dataFrame,
            fields: [...dataFrame.fields, { ...timestampField, name: 'ts' }, { ...lineField, name: 'line' }],
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
