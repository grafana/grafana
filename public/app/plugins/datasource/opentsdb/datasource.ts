import angular, { IQService } from 'angular';
import _ from 'lodash';
import { dateMath, DataQueryRequest } from '@grafana/data';
import { BackendSrv } from 'app/core/services/backend_srv';
import { TemplateSrv } from 'app/features/templating/template_srv';

export default class OpenTsDatasource {
  type: any;
  url: any;
  name: any;
  withCredentials: any;
  basicAuth: any;
  tsdbVersion: any;
  tsdbResolution: any;
  tagKeys: any;

  aggregatorsPromise: any;
  filterTypesPromise: any;

  /** @ngInject */
  constructor(
    instanceSettings: any,
    private $q: IQService,
    private backendSrv: BackendSrv,
    private templateSrv: TemplateSrv
  ) {
    this.type = 'opentsdb';
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.withCredentials = instanceSettings.withCredentials;
    this.basicAuth = instanceSettings.basicAuth;
    instanceSettings.jsonData = instanceSettings.jsonData || {};
    this.tsdbVersion = instanceSettings.jsonData.tsdbVersion || 1;
    this.tsdbResolution = instanceSettings.jsonData.tsdbResolution || 1;
    this.tagKeys = {};

    this.aggregatorsPromise = null;
    this.filterTypesPromise = null;
  }

  // Called once per panel (graph)
  query(options: DataQueryRequest) {
    const start = this.convertToTSDBTime(options.rangeRaw.from, false, options.timezone);
    const end = this.convertToTSDBTime(options.rangeRaw.to, true, options.timezone);
    const qs: any[] = [];

    _.each(options.targets, target => {
      if (!target.metric) {
        return;
      }
      qs.push(this.convertTargetToQuery(target, options, this.tsdbVersion));
    });

    const queries = _.compact(qs);

    // No valid targets, return the empty result to save a round trip.
    if (_.isEmpty(queries)) {
      const d = this.$q.defer();
      d.resolve({ data: [] });
      return d.promise;
    }

    const groupByTags: any = {};
    _.each(queries, query => {
      if (query.filters && query.filters.length > 0) {
        _.each(query.filters, val => {
          groupByTags[val.tagk] = true;
        });
      } else {
        _.each(query.tags, (val, key) => {
          groupByTags[key] = true;
        });
      }
    });

    options.targets = _.filter(options.targets, query => {
      return query.hide !== true;
    });

    return this.performTimeSeriesQuery(queries, start, end).then((response: any) => {
      const metricToTargetMapping = this.mapMetricsToTargets(response.data, options, this.tsdbVersion);
      const result = _.map(response.data, (metricData: any, index: number) => {
        index = metricToTargetMapping[index];
        if (index === -1) {
          index = 0;
        }
        this._saveTagKeys(metricData);

        return this.transformMetricData(metricData, groupByTags, options.targets[index], options, this.tsdbResolution);
      });
      return { data: result };
    });
  }

  annotationQuery(options: any) {
    const start = this.convertToTSDBTime(options.rangeRaw.from, false, options.timezone);
    const end = this.convertToTSDBTime(options.rangeRaw.to, true, options.timezone);
    const qs = [];
    const eventList: any[] = [];

    qs.push({ aggregator: 'sum', metric: options.annotation.target });

    const queries = _.compact(qs);

    return this.performTimeSeriesQuery(queries, start, end).then((results: any) => {
      if (results.data[0]) {
        let annotationObject = results.data[0].annotations;
        if (options.annotation.isGlobal) {
          annotationObject = results.data[0].globalAnnotations;
        }
        if (annotationObject) {
          _.each(annotationObject, annotation => {
            const event = {
              text: annotation.description,
              time: Math.floor(annotation.startTime) * 1000,
              annotation: options.annotation,
            };

            eventList.push(event);
          });
        }
      }
      return eventList;
    });
  }

  targetContainsTemplate(target: any) {
    if (target.filters && target.filters.length > 0) {
      for (let i = 0; i < target.filters.length; i++) {
        if (this.templateSrv.variableExists(target.filters[i].filter)) {
          return true;
        }
      }
    }

    if (target.tags && Object.keys(target.tags).length > 0) {
      for (const tagKey in target.tags) {
        if (this.templateSrv.variableExists(target.tags[tagKey])) {
          return true;
        }
      }
    }

    return false;
  }

  performTimeSeriesQuery(queries: any[], start: any, end: any) {
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
    return this.backendSrv.datasourceRequest(options);
  }

  suggestTagKeys(metric: string | number) {
    return this.$q.when(this.tagKeys[metric] || []);
  }

  _saveTagKeys(metricData: { tags: {}; aggregateTags: any; metric: string | number }) {
    const tagKeys = Object.keys(metricData.tags);
    _.each(metricData.aggregateTags, tag => {
      tagKeys.push(tag);
    });

    this.tagKeys[metricData.metric] = tagKeys;
  }

  _performSuggestQuery(query: string, type: string) {
    return this._get('/api/suggest', { type, q: query, max: 1000 }).then((result: any) => {
      return result.data;
    });
  }

  _performMetricKeyValueLookup(metric: string, keys: any) {
    if (!metric || !keys) {
      return this.$q.when([]);
    }

    const keysArray = keys.split(',').map((key: any) => {
      return key.trim();
    });
    const key = keysArray[0];
    let keysQuery = key + '=*';

    if (keysArray.length > 1) {
      keysQuery += ',' + keysArray.splice(1).join(',');
    }

    const m = metric + '{' + keysQuery + '}';

    return this._get('/api/search/lookup', { m: m, limit: 3000 }).then((result: any) => {
      result = result.data.results;
      const tagvs: any[] = [];
      _.each(result, r => {
        if (tagvs.indexOf(r.tags[key]) === -1) {
          tagvs.push(r.tags[key]);
        }
      });
      return tagvs;
    });
  }

  _performMetricKeyLookup(metric: any) {
    if (!metric) {
      return this.$q.when([]);
    }

    return this._get('/api/search/lookup', { m: metric, limit: 1000 }).then((result: any) => {
      result = result.data.results;
      const tagks: any[] = [];
      _.each(result, r => {
        _.each(r.tags, (tagv, tagk) => {
          if (tagks.indexOf(tagk) === -1) {
            tagks.push(tagk);
          }
        });
      });
      return tagks;
    });
  }

  _get(relativeUrl: string, params?: { type?: string; q?: string; max?: number; m?: any; limit?: number }) {
    const options = {
      method: 'GET',
      url: this.url + relativeUrl,
      params: params,
    };

    this._addCredentialOptions(options);

    return this.backendSrv.datasourceRequest(options);
  }

  _addCredentialOptions(options: any) {
    if (this.basicAuth || this.withCredentials) {
      options.withCredentials = true;
    }
    if (this.basicAuth) {
      options.headers = { Authorization: this.basicAuth };
    }
  }

  metricFindQuery(query: string) {
    if (!query) {
      return this.$q.when([]);
    }

    let interpolated;
    try {
      interpolated = this.templateSrv.replace(query, {}, 'distributed');
    } catch (err) {
      return this.$q.reject(err);
    }

    const responseTransform = (result: any) => {
      return _.map(result, value => {
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
      return this._performSuggestQuery(metricsQuery[1], 'metrics').then(responseTransform);
    }

    const tagNamesQuery = interpolated.match(tagNamesRegex);
    if (tagNamesQuery) {
      return this._performMetricKeyLookup(tagNamesQuery[1]).then(responseTransform);
    }

    const tagValuesQuery = interpolated.match(tagValuesRegex);
    if (tagValuesQuery) {
      return this._performMetricKeyValueLookup(tagValuesQuery[1], tagValuesQuery[2]).then(responseTransform);
    }

    const tagNamesSuggestQuery = interpolated.match(tagNamesSuggestRegex);
    if (tagNamesSuggestQuery) {
      return this._performSuggestQuery(tagNamesSuggestQuery[1], 'tagk').then(responseTransform);
    }

    const tagValuesSuggestQuery = interpolated.match(tagValuesSuggestRegex);
    if (tagValuesSuggestQuery) {
      return this._performSuggestQuery(tagValuesSuggestQuery[1], 'tagv').then(responseTransform);
    }

    return this.$q.when([]);
  }

  testDatasource() {
    return this._performSuggestQuery('cpu', 'metrics').then(() => {
      return { status: 'success', message: 'Data source is working' };
    });
  }

  getAggregators() {
    if (this.aggregatorsPromise) {
      return this.aggregatorsPromise;
    }

    this.aggregatorsPromise = this._get('/api/aggregators').then((result: any) => {
      if (result.data && _.isArray(result.data)) {
        return result.data.sort();
      }
      return [];
    });
    return this.aggregatorsPromise;
  }

  getFilterTypes() {
    if (this.filterTypesPromise) {
      return this.filterTypesPromise;
    }

    this.filterTypesPromise = this._get('/api/config/filters').then((result: any) => {
      if (result.data) {
        return Object.keys(result.data).sort();
      }
      return [];
    });
    return this.filterTypesPromise;
  }

  transformMetricData(md: { dps: any }, groupByTags: any, target: any, options: any, tsdbResolution: number) {
    const metricLabel = this.createMetricLabel(md, target, groupByTags, options);
    const dps: any[] = [];

    // TSDB returns datapoints has a hash of ts => value.
    // Can't use _.pairs(invert()) because it stringifies keys/values
    _.each(md.dps, (v: any, k: number) => {
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
    target: { alias: string },
    groupByTags: any,
    options: { scopedVars: any }
  ) {
    if (target.alias) {
      const scopedVars = _.clone(options.scopedVars || {});
      _.each(md.tags, (value, key) => {
        scopedVars['tag_' + key] = { value: value };
      });
      return this.templateSrv.replace(target.alias, scopedVars);
    }

    let label = md.metric;
    const tagData: any[] = [];

    if (!_.isEmpty(md.tags)) {
      _.each(_.toPairs(md.tags), tag => {
        if (_.has(groupByTags, tag[0])) {
          tagData.push(tag[0] + '=' + tag[1]);
        }
      });
    }

    if (!_.isEmpty(tagData)) {
      label += '{' + tagData.join(', ') + '}';
    }

    return label;
  }

  convertTargetToQuery(target: any, options: any, tsdbVersion: number) {
    if (!target.metric || target.hide) {
      return null;
    }

    const query: any = {
      metric: this.templateSrv.replace(target.metric, options.scopedVars, 'pipe'),
      aggregator: 'avg',
    };

    if (target.aggregator) {
      query.aggregator = this.templateSrv.replace(target.aggregator);
    }

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

    if (target.filters && target.filters.length > 0) {
      query.filters = angular.copy(target.filters);
      if (query.filters) {
        for (const filterKey in query.filters) {
          query.filters[filterKey].filter = this.templateSrv.replace(
            query.filters[filterKey].filter,
            options.scopedVars,
            'pipe'
          );
        }
      }
    } else {
      query.tags = angular.copy(target.tags);
      if (query.tags) {
        for (const tagKey in query.tags) {
          query.tags[tagKey] = this.templateSrv.replace(query.tags[tagKey], options.scopedVars, 'pipe');
        }
      }
    }

    if (target.explicitTags) {
      query.explicitTags = true;
    }

    return query;
  }

  mapMetricsToTargets(metrics: any, options: any, tsdbVersion: number) {
    let interpolatedTagValue, arrTagV;
    return _.map(metrics, metricData => {
      if (tsdbVersion === 3) {
        return metricData.query.index;
      } else {
        return _.findIndex(options.targets as any[], target => {
          if (target.filters && target.filters.length > 0) {
            return target.metric === metricData.metric;
          } else {
            return (
              target.metric === metricData.metric &&
              _.every(target.tags, (tagV, tagK) => {
                interpolatedTagValue = this.templateSrv.replace(tagV, options.scopedVars, 'pipe');
                arrTagV = interpolatedTagValue.split('|');
                return _.includes(arrTagV, metricData.tags[tagK]) || interpolatedTagValue === '*';
              })
            );
          }
        });
      }
    });
  }

  convertToTSDBTime(date: any, roundUp: any, timezone: any) {
    if (date === 'now') {
      return null;
    }

    date = dateMath.parse(date, roundUp, timezone);
    return date.valueOf();
  }
}
