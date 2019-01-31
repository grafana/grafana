import angular from 'angular';
import _ from 'lodash';
import * as dateMath from 'app/core/utils/datemath';

export default class TsdbQuery {
  datasource: any;
  qs: any;
  options: any;
  /** @ngInject */
  constructor(datasource) {
    this.datasource = datasource;
    this.qs = [];
  }

  registerTarget(target, options) {
    this.qs.push(this.convertTargetToQuery(target, options));
    this.options = options;
  }

  getPromises() {
    const start = this.convertToTSDBTime(this.options.rangeRaw.from, false);
    const end = this.convertToTSDBTime(this.options.rangeRaw.to, true);
    const qs = [];

    _.each(this.options.targets, target => {
      if (!target.metric && !target.gexp && !target.exp) {
        return;
      }
      if (!target.queryType) {
        target.queryType = 'metric';
      }
      if (target.queryType === 'metric') {
        qs.push(this.convertTargetToQuery(target, this.options));
      }
    });

    const queries = _.compact(qs);

    // No valid targets, return the empty result to save a round trip.
    if (_.isEmpty(queries)) {
      const d = this.datasource.$q.defer();
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

    const queriesPromises = [];
    if (queries.length > 0) {
      const queriesPromise = this.performTimeSeriesQuery(queries, start, end).then(response => {
        // only index into classic 'metrics' queries
        const tsqTargets = this.options.targets.filter(target => {
          return target.queryType === 'metric';
        });

        const metricToTargetMapping = this.mapMetricsToTargets(
          response.data,
          this.options,
          tsqTargets,
          this.datasource.tsdbVersion
        );

        const result = _.map(response.data, (metricData, index) => {
          index = metricToTargetMapping[index];
          if (index === -1) {
            index = 0;
          }
          this.datasource._saveTagKeys(metricData);

          return this.transformMetricData(
            metricData,
            groupByTags,
            tsqTargets[index],
            this.options,
            this.datasource.tsdbResolution
          );
        });
        return result;
      });
      queriesPromises.push(queriesPromise);
    }
    return queriesPromises;
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
        if (this.datasource.templateSrv.variableExists(target.filters[i].filter)) {
          return true;
        }
      }
    }

    if (target.tags && Object.keys(target.tags).length > 0) {
      for (const tagKey in target.tags) {
        if (this.datasource.templateSrv.variableExists(target.tags[tagKey])) {
          return true;
        }
      }
    }

    return false;
  }

  // retrieve classic Metrics via POST to /api/query
  performTimeSeriesQuery(queries, start, end) {
    let msResolution = false;
    if (this.datasource.tsdbResolution === 2) {
      msResolution = true;
    }
    const reqBody: any = {
      start: start,
      queries: queries,
      msResolution: msResolution,
      globalAnnotations: true,
    };
    if (this.datasource.tsdbVersion === 3) {
      reqBody.showQuery = true;
    }

    // Relative queries (e.g. last hour) don't include an end time
    if (end) {
      reqBody.end = end;
    }

    const options = {
      method: 'POST',
      url: this.datasource.url + '/api/query',
      data: reqBody,
    };

    this.datasource._addCredentialOptions(options);
    return this.datasource.backendSrv.datasourceRequest(options);
  }

  _saveTagKeys(metricData) {
    const tagKeys = Object.keys(metricData.tags);
    _.each(metricData.aggregateTags, tag => {
      tagKeys.push(tag);
    });

    this.datasource.tagKeys[metricData.metric] = tagKeys;
  }

  transformMetricData(md, groupByTags, target, options, tsdbResolution) {
    const metricLabel = this.createMetricLabel(md, target, groupByTags, options);
    const dps = this.getDatapointsAtCorrectResolution(md, tsdbResolution);

    return { target: metricLabel, datapoints: dps };
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

  createMetricLabel(md, target, groupByTags, options) {
    if (target.alias) {
      const scopedVars = _.clone(options.scopedVars || {});
      _.each(md.tags, (value, key) => {
        scopedVars['tag_' + key] = { value: value };
      });
      return this.datasource.templateSrv.replace(target.alias, scopedVars);
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

  convertTargetToQuery(target, options) {
    if (!target.metric || target.hide) {
      return null;
    }

    const query: any = {
      metric: this.datasource.templateSrv.replace(target.metric, options.scopedVars, 'pipe'),
      aggregator: 'avg',
    };

    if (target.aggregator) {
      query.aggregator = this.datasource.templateSrv.replace(target.aggregator);
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

      if (this.datasource.tsdbVersion >= 2) {
        query.rateOptions.dropResets =
          !query.rateOptions.counterMax && (!query.rateOptions.ResetValue || query.rateOptions.ResetValue === 0);
      }
    }

    if (!target.disableDownsampling) {
      let interval = this.datasource.templateSrv.replace(target.downsampleInterval || options.interval);

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
          query.filters[filterKey].filter = this.datasource.templateSrv.replace(
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
          query.tags[tagKey] = this.datasource.templateSrv.replace(query.tags[tagKey], options.scopedVars, 'pipe');
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
                interpolatedTagValue = this.datasource.templateSrv.replace(tagV, options.scopedVars, 'pipe');
                arrTagV = interpolatedTagValue.split('|');
                return _.includes(arrTagV, metricData.tags[tagK]) || interpolatedTagValue === '*';
              })
            );
          }
        });
      }
    });
  }

  convertToTSDBTime(date, roundUp) {
    if (date === 'now') {
      return null;
    }

    date = dateMath.parse(date, roundUp);
    return date.valueOf();
  }
}
