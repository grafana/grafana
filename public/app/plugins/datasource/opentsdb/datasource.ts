import angular from 'angular';
import _ from 'lodash';
import * as dateMath from 'app/core/utils/datemath';

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
  constructor(instanceSettings, private $q, private backendSrv, private templateSrv) {
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
  query(options) {
    const start = this.convertToTSDBTime(options.rangeRaw.from, false);
    const end = this.convertToTSDBTime(options.rangeRaw.to, true);
    const qs = [];
    const gExps = [];
    const exps = [];

    _.each(options.targets, target => {
      if (!target.metric && !target.gexp && !target.exp) {
        return;
      }
      if (!target.queryType) {
        target.queryType = 'metric';
      }
      if (target.queryType === 'metric') {
        qs.push(this.convertTargetToQuery(target, options, this.tsdbVersion));
      } else if (target.queryType === 'gexp') {
        gExps.push(this.convertGExpToQuery(target));
      } else if (target.queryType === 'exp') {
        exps.push(this.convertExpToQuery(target));
      }
    });

    const queries = _.compact(qs);
    const gExpressions = _.compact(gExps);
    const expressions = _.compact(exps);

    // No valid targets, return the empty result to save a round trip.
    if (_.isEmpty(queries) && _.isEmpty(gExpressions) && _.isEmpty(expressions)) {
      const d = this.$q.defer();
      d.resolve({ data: [] });
      return d.promise;
    }

    const groupByTags = {};
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

    let queriesPromise;
    if (queries.length > 0) {
      queriesPromise = this.performTimeSeriesQuery(queries, start, end).then(response => {
        // only index into classic 'metrics' queries
        const tsqTargets = options.targets.filter(target => {
          return target.queryType === 'metric';
        });

        const metricToTargetMapping = this.mapMetricsToTargets(response.data, options, tsqTargets, this.tsdbVersion);

        const result = _.map(response.data, (metricData, index) => {
          index = metricToTargetMapping[index];
          if (index === -1) {
            index = 0;
          }
          this._saveTagKeys(metricData);

          return this.transformMetricData(metricData, groupByTags, tsqTargets[index], options, this.tsdbResolution);
        });
        return result;
      });
    }

    // perform single exp queries so that we can reliably map targets to results once all the promises are resolved
    // (/query/exp can perform combined queries but the result order is not determinate)
    const expPromises = [];
    if (expressions.length > 0) {
      for (let expIndex = 0; expIndex < expressions.length; expIndex++) {
        const expPromise = this.performExpressionQuery(expIndex, expressions[expIndex], start, end, options).then(
          response => {
            // only index into exp queries
            const expTargets = options.targets.filter(target => {
              return target.queryType === 'exp';
            });

            const expTargetIndex = this.mapExpToTargets(response.outputs, response.config.url);

            const result = _.map(response.data, expData => {
              let index = expTargetIndex;
              if (index === -1) {
                index = 0;
              }
              return this.transformExpData(expData, expTargets[index], this.tsdbResolution);
            });

            return result.filter(value => {
              return value !== false;
            });
          }
        );

        expPromises.push(expPromise);
      }
    }

    // perform single gExp queries so that we can reliably map targets to results once all the promises are resolved
    // (/query/gexp can perform combined queries but the result order is not determinate)
    const gexpPromises = [];
    if (gExpressions.length > 0) {
      for (let gexpIndex = 0; gexpIndex < gExpressions.length; gexpIndex++) {
        const gexpPromise = this.performGExpressionQuery(gexpIndex, gExpressions[gexpIndex], start, end, options).then(
          response => {
            // only index into gexp queries
            const gexpTargets = options.targets.filter(target => {
              return target.queryType === 'gexp';
            });

            const gExpTargetIndex = this.mapGExpToTargets(response.config.url);

            const result = _.map(response.data, gexpData => {
              let index = gExpTargetIndex;
              if (index === -1) {
                index = 0;
              }
              return this.transformGexpData(gexpData, gexpTargets[index], this.tsdbResolution);
            });

            return result.filter(value => {
              return value !== false;
            });
          }
        );

        gexpPromises.push(gexpPromise);
      }
    }

    // call all queries into an array and concaternate their data into a return object
    const tsdbQueryDict = {};
    // tsdbQueryDict['queries'] = queriesPromise;
    // tsdbQueryDict['gexp'] = gexpPromises;
    // tsdbQueryDict['exp'] = expPromises;
    const tsdbQueryPromises = [queriesPromise].concat(gexpPromises).concat(this.reformatExpData(expPromises));

    // q.all([]) resolves all promises while keeping order in the return array
    // (see: https://docs.angularjs.org/api/ng/service/$q#all)
    return this.$q.all(tsdbQueryPromises).then(responses => {
      let data = [];

      // response 0 from queriesPromise

      _.each(responses, response => {
        data = data.concat(response);
      });

      // const queriesData = responses[0];
      // if (queriesData && queriesData.length > 0) {
      //   data = data.concat(queriesData);
      // }
      //
      // // response 1+ from gexpPromises
      // for (const gexpData of responses.slice(1)) {
      //   data = data.concat(gexpData);
      // }
      //
      // // response 2+ from expPromises
      // for (const expData of responses.slice(2)) {
      //   data = data.concat(this.reformatExpData(expData));
      // }

      // the return object must look like:
      // {
      //   'data': [
      //     {'target': 'metric.a', datapoints: [etc]},
      //     {'target': 'metric.b', datapoints: [etc]},
      //   ]
      // }
      //console.log('query data back to grafana', data);
      return {
        data: data,
      };
    });
  }

  annotationQuery(options) {
    const start = this.convertToTSDBTime(options.rangeRaw.from, false);
    const end = this.convertToTSDBTime(options.rangeRaw.to, true);
    const qs = [];
    const eventList = [];

    qs.push({ aggregator: 'sum', metric: options.annotation.target });

    const queries = _.compact(qs);

    return this.performTimeSeriesQuery(queries, start, end).then(results => {
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

  targetContainsTemplate(target) {
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

  // retrieve classic Metrics via POST to /api/query
  performTimeSeriesQuery(queries, start, end) {
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

  performExpressionQuery(idx, exp, start, end, globalOptions) {
    let urlParams = '?expIndex=' + idx;
    urlParams = this.templateSrv.replace(urlParams, globalOptions.scopedVars, 'pipe');

    exp['time']['start'] = start;

    const options = {
      method: 'POST',
      url: this.url + '/api/query/exp' + urlParams,
      data: exp,
    };
    if (end) {
      exp['time']['end'] = end;
    }
    // Relative queries (e.g. last hour) don't include an end time

    this._addCredentialOptions(options);
    return this.backendSrv.datasourceRequest(options);
  }

  // retrieve a single gExp via GET to /api/query/gexp
  performGExpressionQuery(idx, gExp, start, end, globalOptions) {
    let urlParams = '?start=' + start + '&exp=' + gExp + '&gexpIndex=' + idx;
    urlParams = this.templateSrv.replace(urlParams, globalOptions.scopedVars, 'pipe');
    const options = {
      method: 'GET',
      url: this.url + '/api/query/gexp' + urlParams,
    };

    // Relative queries (e.g. last hour) don't include an end time
    if (end) {
      urlParams = '&end=' + end;
    }

    this._addCredentialOptions(options);
    return this.backendSrv.datasourceRequest(options);
  }

  suggestTagKeys(metric) {
    return this.$q.when(this.tagKeys[metric] || []);
  }

  _saveTagKeys(metricData) {
    const tagKeys = Object.keys(metricData.tags);
    _.each(metricData.aggregateTags, tag => {
      tagKeys.push(tag);
    });

    this.tagKeys[metricData.metric] = tagKeys;
  }

  _performSuggestQuery(query, type) {
    return this._get('/api/suggest', { type: type, q: query, max: 1000 }).then(result => {
      return result.data;
    });
  }

  _performMetricKeyValueLookup(metric, keys) {
    if (!metric || !keys) {
      return this.$q.when([]);
    }

    const keysArray = keys.split(',').map(key => {
      return key.trim();
    });
    const key = keysArray[0];
    let keysQuery = key + '=*';

    if (keysArray.length > 1) {
      keysQuery += ',' + keysArray.splice(1).join(',');
    }

    const m = metric + '{' + keysQuery + '}';

    return this._get('/api/search/lookup', { use_meta: true, m: m, limit: 3000 }).then(result => {
      result = result.data.results;
      const tagvs = [];
      _.each(result, r => {
        if (tagvs.indexOf(r.tags[key]) === -1) {
          tagvs.push(r.tags[key]);
        }
      });
      return tagvs;
    });
  }

  _performMetricKeyLookup(metric) {
    if (!metric) {
      return this.$q.when([]);
    }

    return this._get('/api/search/lookup', { use_meta: true, m: metric, limit: 1000 }).then(result => {
      result = result.data.results;
      const tagks = [];
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

  _get(relativeUrl, params?) {
    const options = {
      method: 'GET',
      url: this.url + relativeUrl,
      params: params,
    };

    this._addCredentialOptions(options);

    return this.backendSrv.datasourceRequest(options);
  }

  _addCredentialOptions(options) {
    if (this.basicAuth || this.withCredentials) {
      options.withCredentials = true;
    }
    if (this.basicAuth) {
      options.headers = { Authorization: this.basicAuth };
    }
  }

  metricFindQuery(query) {
    if (!query) {
      return this.$q.when([]);
    }

    let interpolated;
    try {
      interpolated = this.templateSrv.replace(query, {}, 'distributed');
    } catch (err) {
      return this.$q.reject(err);
    }

    const responseTransform = result => {
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

    this.aggregatorsPromise = this._get('/api/aggregators').then(result => {
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

    this.filterTypesPromise = this._get('/api/config/filters').then(result => {
      if (result.data) {
        return Object.keys(result.data).sort();
      }
      return [];
    });
    return this.filterTypesPromise;
  }

  transformMetricData(md, groupByTags, target, options, tsdbResolution) {
    const metricLabel = this.createMetricLabel(md, target, groupByTags, options);
    const dps = this.getDatapointsAtCorrectResolution(md, tsdbResolution);

    return { target: metricLabel, datapoints: dps };
  }

  transformExpData(exp, target, tsdbResolution) {
    if (typeof target === 'undefined') {
      // the metric is hidden
      return false;
    }

    const metricLabel = this.createExpMetricLabel(exp);

    // exp is the query, not the result

    const dps = this.getExpDatapointsAtCorrectResolution(exp, tsdbResolution);
    return { target: metricLabel, datapoints: dps };
  }

  transformGexpData(gExp, target, tsdbResolution) {
    if (typeof target === 'undefined') {
      // the metric is hidden
      return false;
    }

    const metricLabel = this.createGexpLabel(gExp, target);
    const dps = this.getDatapointsAtCorrectResolution(gExp, tsdbResolution);

    return { target: metricLabel, datapoints: dps };
  }

  getExpDatapointsAtCorrectResolution(result, tsdbResolution) {
    const dps = [];

    // TSDB returns datapoints has a hash of ts => value.
    // Can't use _.pairs(invert()) because it stringifies keys/values
    _.each(result.outputs.dps, (v, k) => {
      if (tsdbResolution === 2) {
        dps.push([v, k * 1]);
      } else {
        dps.push([v, k * 1000]);
      }
    });

    return dps;
  }

  getDatapointsAtCorrectResolution(result, tsdbResolution) {
    const dps = [];

    // TSDB returns datapoints has a hash of ts => value.
    // Can't use _.pairs(invert()) because it stringifies keys/values
    _.each(result.dps, (v, k) => {
      if (tsdbResolution === 2) {
        dps.push([v, k * 1]);
      } else {
        dps.push([v, k * 1000]);
      }
    });

    return dps;
  }

  createExpMetricLabel(md) {
    const label = md.id;
    return label;
  }

  createMetricLabel(md, target, groupByTags, options) {
    if (target.alias) {
      const scopedVars = _.clone(options.scopedVars || {});
      _.each(md.tags, (value, key) => {
        scopedVars['tag_' + key] = { value: value };
      });
      return this.templateSrv.replace(target.alias, scopedVars);
    }

    let label = md.metric;
    const tagData = [];

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

  createGexpLabel(data, target) {
    if (!target.gexpAlias) {
      return target.gexp;
    }

    return target.gexpAlias.replace(/\$tag_([a-zA-Z0-9-_\.\/]+)/g, (all, m1) => data.tags[m1]);
  }

  convertExpToQuery(target) {
    // filter out a target if it is 'hidden'
    if (target.hide === true) {
      return null;
    }
    return JSON.parse(target.exp);
  }

  convertGExpToQuery(target) {
    // filter out a target if it is 'hidden'
    if (target.hide === true) {
      return null;
    }
    return target.gexp;
  }

  convertTargetToQuery(target, options, tsdbVersion) {
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

  mapMetricsToTargets(metrics, targets, options, tsdbVersion) {
    let interpolatedTagValue, arrTagV;
    return _.map(metrics, metricData => {
      if (tsdbVersion === 3) {
        return metricData.query.index;
      } else {
        return _.findIndex(targets, target => {
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

  mapExpToTargets(outputs, queryUrl) {
    // extract gexpIndex from URL
    const regex = /.+expIndex=(\d+).*/;
    const expIndex = queryUrl.match(regex);

    if (!expIndex) {
      return -1;
    }

    return expIndex[1];
  }

  mapGExpToTargets(queryUrl) {
    // extract gexpIndex from URL
    const regex = /.+gexpIndex=(\d+).*/;
    const gexpIndex = queryUrl.match(regex);

    if (!gexpIndex) {
      return -1;
    }

    return gexpIndex[1];
  }

  convertToTSDBTime(date, roundUp) {
    if (date === 'now') {
      return null;
    }

    date = dateMath.parse(date, roundUp);
    return date.valueOf();
  }

  async reformatExpData(expData) {
    const results = await expData;
    console.log(expData);
  }
}
