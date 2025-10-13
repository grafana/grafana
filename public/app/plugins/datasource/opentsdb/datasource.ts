import {
  clone,
  cloneDeep,
  compact,
  each,
  every,
  filter,
  findIndex,
  has,
  includes,
  isArray,
  isEmpty,
  map as _map,
  toPairs,
} from 'lodash';
import { lastValueFrom, merge, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import {
  AnnotationEvent,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  dateMath,
  DateTime,
  ScopedVars,
  toDataFrame,
} from '@grafana/data';
import { FetchResponse, getBackendSrv } from '@grafana/runtime';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';

import { AnnotationEditor } from './components/AnnotationEditor';
import { prepareAnnotation } from './migrations';
import { OpenTsdbFilter, OpenTsdbOptions, OpenTsdbQuery } from './types';

export default class OpenTsDatasource extends DataSourceApi<OpenTsdbQuery, OpenTsdbOptions> {
  type: 'opentsdb';
  url: string;
  name: string;
  withCredentials: boolean;
  basicAuth: any;
  tsdbVersion: number;
  tsdbResolution: number;
  lookupLimit: number;
  tagKeys: Record<string | number, string[]>;

  aggregatorsPromise: Promise<string[]> | null;
  filterTypesPromise: Promise<string[]> | null;

  constructor(
    instanceSettings: any,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.type = 'opentsdb';
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.withCredentials = instanceSettings.withCredentials;
    this.basicAuth = instanceSettings.basicAuth;
    instanceSettings.jsonData = instanceSettings.jsonData || {};
    this.tsdbVersion = instanceSettings.jsonData.tsdbVersion || 1;
    this.tsdbResolution = instanceSettings.jsonData.tsdbResolution || 1;
    this.lookupLimit = instanceSettings.jsonData.lookupLimit || 1000;
    this.tagKeys = {};

    this.aggregatorsPromise = null;
    this.filterTypesPromise = null;
    this.annotations = {
      QueryEditor: AnnotationEditor,
      prepareAnnotation,
    };
  }

  // Called once per panel (graph)
  query(options: DataQueryRequest<OpenTsdbQuery>): Observable<DataQueryResponse> {
    // migrate annotations
    if (options.targets.some((target: OpenTsdbQuery) => target.fromAnnotations)) {
      const streams: Array<Observable<DataQueryResponse>> = [];

      for (const annotation of options.targets) {
        if (annotation.target) {
          streams.push(
            new Observable((subscriber) => {
              this.annotationEvent(options, annotation)
                .then((events) => subscriber.next({ data: [toDataFrame(events)] }))
                .catch((ex) => {
                  // grafana fetch throws the error so for annotation consistency among datasources
                  // we return an empty array which displays as 'no events found'
                  // in the annnotation editor
                  return subscriber.next({ data: [toDataFrame([])] });
                })
                .finally(() => subscriber.complete());
            })
          );
        }
      }

      return merge(...streams);
    }

    const start = this.convertToTSDBTime(options.range.raw.from, false, options.timezone);
    const end = this.convertToTSDBTime(options.range.raw.to, true, options.timezone);
    const qs: any[] = [];

    each(options.targets, (target) => {
      if (!target.metric) {
        return;
      }
      qs.push(this.convertTargetToQuery(target, options, this.tsdbVersion));
    });

    const queries = compact(qs);

    // No valid targets, return the empty result to save a round trip.
    if (isEmpty(queries)) {
      return of({ data: [] });
    }

    const groupByTags: Record<string, boolean> = {};
    each(queries, (query) => {
      if (query.filters && query.filters.length > 0) {
        each(query.filters, (val) => {
          groupByTags[val.tagk] = true;
        });
      } else {
        each(query.tags, (val, key) => {
          groupByTags[key] = true;
        });
      }
    });

    options.targets = filter(options.targets, (query) => {
      return query.hide !== true;
    });

    return this.performTimeSeriesQuery(queries, start, end).pipe(
      catchError((err) => {
        // Throw the error message here instead of the whole object to workaround the error parsing error.
        throw err?.data?.error?.message || 'Error performing time series query.';
      }),
      map((response) => {
        const metricToTargetMapping = this.mapMetricsToTargets(response.data, options, this.tsdbVersion);
        const result = _map(response.data, (metricData, index: number) => {
          index = metricToTargetMapping[index];
          if (index === -1) {
            index = 0;
          }
          this._saveTagKeys(metricData);

          return this.transformMetricData(
            metricData,
            groupByTags,
            options.targets[index],
            options,
            this.tsdbResolution
          );
        });
        return { data: result };
      })
    );
  }

  annotationEvent(options: DataQueryRequest, annotation: OpenTsdbQuery): Promise<AnnotationEvent[]> {
    const start = this.convertToTSDBTime(options.range.raw.from, false, options.timezone);
    const end = this.convertToTSDBTime(options.range.raw.to, true, options.timezone);
    const qs = [];
    const eventList: AnnotationEvent[] = [];

    qs.push({ aggregator: 'sum', metric: annotation.target });

    const queries = compact(qs);

    return lastValueFrom(
      this.performTimeSeriesQuery(queries, start, end).pipe(
        map((results) => {
          if (results.data[0]) {
            let annotationObject = results.data[0].annotations;
            if (annotation.isGlobal) {
              annotationObject = results.data[0].globalAnnotations;
            }
            if (annotationObject) {
              each(annotationObject, (ann) => {
                const event = {
                  text: ann.description,
                  time: Math.floor(ann.startTime) * 1000,
                  annotation: annotation,
                };

                eventList.push(event);
              });
            }
          }
          return eventList;
        })
      )
    );
  }

  targetContainsTemplate(target: any) {
    if (target.filters && target.filters.length > 0) {
      for (let i = 0; i < target.filters.length; i++) {
        if (this.templateSrv.containsTemplate(target.filters[i].filter)) {
          return true;
        }
      }
    }

    if (target.tags && Object.keys(target.tags).length > 0) {
      for (const tagKey in target.tags) {
        if (this.templateSrv.containsTemplate(target.tags[tagKey])) {
          return true;
        }
      }
    }

    return false;
  }

  performTimeSeriesQuery(queries: any[], start: number | null, end: number | null): Observable<FetchResponse> {
    let msResolution = false;
    if (this.tsdbResolution === 2) {
      msResolution = true;
    }
    const reqBody: any = {
      start: start,
      queries: queries,
      msResolution: msResolution,
      globalAnnotations: true,
    };
    if (this.tsdbVersion === 3) {
      reqBody.showQuery = true;
    }

    // Relative queries (e.g. last hour) don't include an end time
    if (end) {
      reqBody.end = end;
    }

    const options = {
      method: 'POST',
      url: this.url + '/api/query',
      data: reqBody,
    };

    this._addCredentialOptions(options);
    return getBackendSrv().fetch(options);
  }

  suggestTagKeys(query: OpenTsdbQuery) {
    const metric = query.metric ?? '';
    return Promise.resolve(this.tagKeys[metric] || []);
  }

  _saveTagKeys(metricData: { tags: {}; aggregateTags: any; metric: string | number }) {
    const tagKeys = Object.keys(metricData.tags);
    each(metricData.aggregateTags, (tag) => {
      tagKeys.push(tag);
    });

    this.tagKeys[metricData.metric] = tagKeys;
  }

  _performSuggestQuery(query: string, type: string) {
    return this._get('/api/suggest', { type, q: query, max: this.lookupLimit }).pipe(
      map((result) => {
        return result.data;
      })
    );
  }

  _performMetricKeyValueLookup(metric: string, keys: string) {
    if (!metric || !keys) {
      return of([]);
    }

    const keysArray = keys.split(',').map((key) => {
      return key.trim();
    });
    const key = keysArray[0];
    let keysQuery = key + '=*';

    if (keysArray.length > 1) {
      keysQuery += ',' + keysArray.splice(1).join(',');
    }

    const m = metric + '{' + keysQuery + '}';

    return this._get('/api/search/lookup', { m: m, limit: this.lookupLimit }).pipe(
      map((result) => {
        result = result.data.results;
        const tagvs: any[] = [];
        each(result, (r) => {
          if (tagvs.indexOf(r.tags[key]) === -1) {
            tagvs.push(r.tags[key]);
          }
        });
        return tagvs;
      })
    );
  }

  _performMetricKeyLookup(metric: string) {
    if (!metric) {
      return of([]);
    }

    return this._get('/api/search/lookup', { m: metric, limit: 1000 }).pipe(
      map((result) => {
        result = result.data.results;
        const tagks: any[] = [];
        each(result, (r) => {
          each(r.tags, (tagv, tagk) => {
            if (tagks.indexOf(tagk) === -1) {
              tagks.push(tagk);
            }
          });
        });
        return tagks;
      })
    );
  }

  _get(
    relativeUrl: string,
    params?: { type?: string; q?: string; max?: number; m?: string; limit?: number }
  ): Observable<FetchResponse> {
    const options = {
      method: 'GET',
      url: this.url + relativeUrl,
      params: params,
    };

    this._addCredentialOptions(options);

    return getBackendSrv().fetch(options);
  }

  _addCredentialOptions(options: Record<string, unknown>) {
    if (this.basicAuth || this.withCredentials) {
      options.withCredentials = true;
    }
    if (this.basicAuth) {
      options.headers = { Authorization: this.basicAuth };
    }
  }

  metricFindQuery(query: string) {
    if (!query) {
      return Promise.resolve([]);
    }

    let interpolated;
    try {
      interpolated = this.templateSrv.replace(query, {}, 'distributed');
    } catch (err) {
      return Promise.reject(err);
    }

    const responseTransform = (result: any) => {
      return _map(result, (value) => {
        return { text: value };
      });
    };

    const metricsRegex = /metrics\((.*)\)/;
    const tagNamesRegex = /tag_names\((.*)\)/;
    const tagValuesRegex = /tag_values\((.*?),\s?(.*)\)/;
    const tagNamesSuggestRegex = /suggest_tagk\((.*)\)/;
    const tagValuesSuggestRegex = /suggest_tagv\((.*)\)/;

    const metricsQuery = interpolated.match(metricsRegex);
    if (metricsQuery) {
      return lastValueFrom(this._performSuggestQuery(metricsQuery[1], 'metrics').pipe(map(responseTransform)));
    }

    const tagNamesQuery = interpolated.match(tagNamesRegex);
    if (tagNamesQuery) {
      return lastValueFrom(this._performMetricKeyLookup(tagNamesQuery[1]).pipe(map(responseTransform)));
    }

    const tagValuesQuery = interpolated.match(tagValuesRegex);
    if (tagValuesQuery) {
      return lastValueFrom(
        this._performMetricKeyValueLookup(tagValuesQuery[1], tagValuesQuery[2]).pipe(map(responseTransform))
      );
    }

    const tagNamesSuggestQuery = interpolated.match(tagNamesSuggestRegex);
    if (tagNamesSuggestQuery) {
      return lastValueFrom(this._performSuggestQuery(tagNamesSuggestQuery[1], 'tagk').pipe(map(responseTransform)));
    }

    const tagValuesSuggestQuery = interpolated.match(tagValuesSuggestRegex);
    if (tagValuesSuggestQuery) {
      return lastValueFrom(this._performSuggestQuery(tagValuesSuggestQuery[1], 'tagv').pipe(map(responseTransform)));
    }

    return Promise.resolve([]);
  }

  testDatasource() {
    return lastValueFrom(
      this._performSuggestQuery('cpu', 'metrics').pipe(
        map(() => {
          return { status: 'success', message: 'Data source is working' };
        })
      )
    );
  }

  getAggregators() {
    if (this.aggregatorsPromise) {
      return this.aggregatorsPromise;
    }

    this.aggregatorsPromise = lastValueFrom(
      this._get('/api/aggregators').pipe(
        map((result) => {
          if (result.data && isArray(result.data)) {
            return result.data.sort();
          }
          return [];
        })
      )
    );
    return this.aggregatorsPromise;
  }

  getFilterTypes() {
    if (this.filterTypesPromise) {
      return this.filterTypesPromise;
    }

    this.filterTypesPromise = lastValueFrom(
      this._get('/api/config/filters').pipe(
        map((result) => {
          if (result.data) {
            return Object.keys(result.data).sort();
          }
          return [];
        })
      )
    );
    return this.filterTypesPromise;
  }

  transformMetricData(
    md: { dps: any },
    groupByTags: Record<string, boolean>,
    target: OpenTsdbQuery,
    options: DataQueryRequest<OpenTsdbQuery>,
    tsdbResolution: number
  ) {
    const metricLabel = this.createMetricLabel(md, target, groupByTags, options);
    const dps: any[] = [];

    // TSDB returns datapoints has a hash of ts => value.
    // Can't use pairs(invert()) because it stringifies keys/values
    each(md.dps, (v, k: number) => {
      if (tsdbResolution === 2) {
        dps.push([v, k * 1]);
      } else {
        dps.push([v, k * 1000]);
      }
    });

    return { target: metricLabel, datapoints: dps };
  }

  createMetricLabel(
    md: { dps?: any; tags?: any; metric?: any },
    target: OpenTsdbQuery,
    groupByTags: Record<string, boolean>,
    options: DataQueryRequest<OpenTsdbQuery>
  ) {
    if (target.alias) {
      const scopedVars = clone(options.scopedVars || {});
      each(md.tags, (value, key) => {
        scopedVars['tag_' + key] = { value: value };
      });
      return this.templateSrv.replace(target.alias, scopedVars);
    }

    let label = md.metric;
    const tagData: any[] = [];

    if (!isEmpty(md.tags)) {
      each(toPairs(md.tags), (tag) => {
        if (has(groupByTags, tag[0])) {
          tagData.push(tag[0] + '=' + tag[1]);
        }
      });
    }

    if (!isEmpty(tagData)) {
      label += '{' + tagData.join(', ') + '}';
    }

    return label;
  }

  convertTargetToQuery(target: OpenTsdbQuery, options: DataQueryRequest<OpenTsdbQuery>, tsdbVersion: number) {
    if (!target.metric || target.hide) {
      return null;
    }

    const query = this.interpolateVariablesInQuery(target, options.scopedVars);

    if (target.shouldComputeRate) {
      query.rate = true;
      query.rateOptions = {
        counter: !!target.isCounter,
      };

      if (target.counterMax && target.counterMax.length) {
        query.rateOptions.counterMax = parseInt(target.counterMax, 10);
      }

      if (target.counterResetValue && target.counterResetValue.length) {
        query.rateOptions.resetValue = parseInt(target.counterResetValue, 10);
      }

      if (tsdbVersion >= 2) {
        query.rateOptions.dropResets =
          !query.rateOptions.counterMax && (!query.rateOptions.ResetValue || query.rateOptions.ResetValue === 0);
      }
    }

    if (!target.disableDownsampling) {
      let interval = this.templateSrv.replace(target.downsampleInterval || options.interval);

      if (interval.match(/\.[0-9]+s/)) {
        interval = parseFloat(interval) * 1000 + 'ms';
      }

      query.downsample = interval + '-' + target.downsampleAggregator;

      if (target.downsampleFillPolicy && target.downsampleFillPolicy !== 'none') {
        query.downsample += '-' + target.downsampleFillPolicy;
      }
    }

    if (target.explicitTags) {
      query.explicitTags = true;
    }

    return query;
  }

  interpolateVariablesInFilters(query: OpenTsdbQuery, scopedVars: ScopedVars) {
    query.filters = query.filters?.map((filter: OpenTsdbFilter): OpenTsdbFilter => {
      filter.tagk = this.templateSrv.replace(filter.tagk, scopedVars, 'pipe');

      filter.filter = this.templateSrv.replace(filter.filter, scopedVars, 'pipe');

      return filter;
    });
  }

  getVariables(): string[] {
    return this.templateSrv.getVariables().map((v) => `$${v.name}`);
  }

  mapMetricsToTargets(metrics: any, options: DataQueryRequest<OpenTsdbQuery>, tsdbVersion: number) {
    let interpolatedTagValue, arrTagV;
    return _map(metrics, (metricData) => {
      if (tsdbVersion === 3) {
        return metricData.query.index;
      } else {
        return findIndex(options.targets, (target) => {
          if (target.filters && target.filters.length > 0) {
            return target.metric === metricData.metric;
          } else {
            return (
              target.metric === metricData.metric &&
              every(target.tags, (tagV, tagK) => {
                interpolatedTagValue = this.templateSrv.replace(tagV, options.scopedVars, 'pipe');
                arrTagV = interpolatedTagValue.split('|');
                return includes(arrTagV, metricData.tags[tagK]) || interpolatedTagValue === '*';
              })
            );
          }
        });
      }
    });
  }

  interpolateVariablesInQueries(queries: OpenTsdbQuery[], scopedVars: ScopedVars): OpenTsdbQuery[] {
    if (!queries.length) {
      return queries;
    }

    return queries.map((query) => this.interpolateVariablesInQuery(query, scopedVars));
  }

  interpolateVariablesInQuery(target: OpenTsdbQuery, scopedVars: ScopedVars): any {
    const query = cloneDeep(target);

    query.metric = this.templateSrv.replace(target.metric, scopedVars, 'pipe');

    query.aggregator = 'avg';
    if (target.aggregator) {
      query.aggregator = this.templateSrv.replace(target.aggregator);
    }

    if (query.filters && query.filters.length > 0) {
      this.interpolateVariablesInFilters(query, scopedVars);
    } else {
      if (query.tags) {
        for (const tagKey in query.tags) {
          query.tags[tagKey] = this.templateSrv.replace(query.tags[tagKey], scopedVars, 'pipe');
        }
      }
    }

    return query;
  }

  convertToTSDBTime(date: string | DateTime, roundUp: boolean, timezone: string) {
    if (date === 'now') {
      return null;
    }

    const dateTime = dateMath.parse(date, roundUp, timezone);
    return dateTime?.valueOf() ?? null;
  }
}
