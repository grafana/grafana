import _ from 'lodash';

export default class GexpQuery {
  datasource: any;
  qs: any;
  options: any;

  /** @ngInject */
  constructor(datasource) {
    this.datasource = datasource;
    this.qs = [];
  }

  registerTarget(target, options) {
    this.qs.push(this.convertTargetToQuery(target));
    this.options = options;
  }

  getPromises() {
    const start = this.datasource.convertToTSDBTime(this.options.rangeRaw.from, false);
    const end = this.datasource.convertToTSDBTime(this.options.rangeRaw.to, true);

    const queries = _.compact(this.qs);

    // No valid targets, return the empty result to save a round trip.
    if (_.isEmpty(queries)) {
      const d = this.datasource.$q.defer();
      d.resolve({ data: [] });
      return d.promise;
    }

    const queriesPromises = [queries.length];
    if (queries.length > 0) {
      for (let qIndex = 0; qIndex < queries.length; qIndex++) {
        const queriesPromise = this.performTimeSeriesQuery(qIndex, queries[qIndex], start, end, this.options).then(
          response => {
            const targets = this.options.targets;

            const targetIndex = this.mapMetricsToTargets(response.config.url);

            const result = _.map(response.data, queryData => {
              let index = targetIndex;
              if (index === -1) {
                index = 0;
              }
              return this.transformMetricData(queryData, targets[index], this.datasource.tsdbResolution);
            });

            return result.filter(value => {
              return value !== false;
            });
          }
        );

        queriesPromises[qIndex] = queriesPromise;
      }
    }
    return queriesPromises;
  }

  performTimeSeriesQuery(idx, query, start, end, globalOptions) {
    let urlParams = '?start=' + start + '&exp=' + query + '&gexpIndex=' + idx;
    urlParams = this.datasource.templateSrv.replace(urlParams, globalOptions.scopedVars, 'pipe');
    const options = {
      method: 'GET',
      url: this.datasource.url + '/api/query/gexp' + urlParams,
    };
    if (end) {
      urlParams = '&end=' + end;
    }

    this.datasource._addCredentialOptions(options);
    return this.datasource.backendSrv.datasourceRequest(options);
  }

  transformMetricData(query, target, tsdbResolution) {
    if (typeof target === 'undefined') {
      // the metric is hidden
      return false;
    }

    const metricLabel = this.createMetricLabel(query, target);
    const dps = this.getDatapointsAtCorrectResolution(query, tsdbResolution);
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

  createMetricLabel(data, target) {
    if (!target.alias) {
      return target.gexp;
    }
    return target.alias.replace(/\$tag_([a-zA-Z0-9-_\.\/]+)/g, (all, m1) => data.tags[m1]);
  }

  convertTargetToQuery(target) {
    // filter out a target if it is 'hidden'
    if (target.hide === true) {
      return null;
    }
    return target.gexp;
  }

  mapMetricsToTargets(queryUrl) {
    // extract gexpIndex from URL
    const regex = /.+gexpIndex=(\d+).*/;
    const gexpIndex = queryUrl.match(regex);

    if (!gexpIndex) {
      return -1;
    }

    return gexpIndex[1];
  }
}
