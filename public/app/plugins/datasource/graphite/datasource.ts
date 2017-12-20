///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import * as dateMath from 'app/core/utils/datemath';
import { isVersionGtOrEq, SemVersion } from 'app/core/utils/version';

/** @ngInject */
export function GraphiteDatasource(
  instanceSettings,
  $q,
  backendSrv,
  templateSrv
) {
  this.basicAuth = instanceSettings.basicAuth;
  this.url = instanceSettings.url;
  this.name = instanceSettings.name;
  this.graphiteVersion = instanceSettings.jsonData.graphiteVersion || '0.9';
  this.supportsTags = supportsTags(this.graphiteVersion);
  this.cacheTimeout = instanceSettings.cacheTimeout;
  this.withCredentials = instanceSettings.withCredentials;
  this.render_method = instanceSettings.render_method || 'POST';

  this.getQueryOptionsInfo = function() {
    return {
      maxDataPoints: true,
      cacheTimeout: true,
      links: [
        {
          text: 'Help',
          url:
            'http://docs.grafana.org/features/datasources/graphite/#using-graphite-in-grafana',
        },
      ],
    };
  };

  this.query = function(options) {
    var graphOptions = {
      from: this.translateTime(options.rangeRaw.from, false),
      until: this.translateTime(options.rangeRaw.to, true),
      targets: options.targets,
      format: options.format,
      cacheTimeout: options.cacheTimeout || this.cacheTimeout,
      maxDataPoints: options.maxDataPoints,
    };

    var params = this.buildGraphiteParams(graphOptions, options.scopedVars);
    if (params.length === 0) {
      return $q.when({ data: [] });
    }

    var httpOptions: any = {
      method: 'POST',
      url: '/render',
      data: params.join('&'),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    if (options.panelId) {
      httpOptions.requestId = this.name + '.panelId.' + options.panelId;
    }

    return this.doGraphiteRequest(httpOptions).then(this.convertDataPointsToMs);
  };

  this.convertDataPointsToMs = function(result) {
    if (!result || !result.data) {
      return [];
    }
    for (var i = 0; i < result.data.length; i++) {
      var series = result.data[i];
      for (var y = 0; y < series.datapoints.length; y++) {
        series.datapoints[y][1] *= 1000;
      }
    }
    return result;
  };

  this.parseTags = function(tagString) {
    let tags = [];
    tags = tagString.split(',');
    if (tags.length === 1) {
      tags = tagString.split(' ');
      if (tags[0] === '') {
        tags = [];
      }
    }
    return tags;
  };

  this.annotationQuery = function(options) {
    // Graphite metric as annotation
    if (options.annotation.target) {
      var target = templateSrv.replace(options.annotation.target, {}, 'glob');
      var graphiteQuery = {
        rangeRaw: options.rangeRaw,
        targets: [{ target: target }],
        format: 'json',
        maxDataPoints: 100,
      };

      return this.query(graphiteQuery).then(function(result) {
        var list = [];

        for (var i = 0; i < result.data.length; i++) {
          var target = result.data[i];

          for (var y = 0; y < target.datapoints.length; y++) {
            var datapoint = target.datapoints[y];
            if (!datapoint[0]) {
              continue;
            }

            list.push({
              annotation: options.annotation,
              time: datapoint[1],
              title: target.target,
            });
          }
        }

        return list;
      });
    } else {
      // Graphite event as annotation
      var tags = templateSrv.replace(options.annotation.tags);
      return this.events({ range: options.rangeRaw, tags: tags }).then(
        results => {
          var list = [];
          for (var i = 0; i < results.data.length; i++) {
            var e = results.data[i];

            var tags = e.tags;
            if (_.isString(e.tags)) {
              tags = this.parseTags(e.tags);
            }

            list.push({
              annotation: options.annotation,
              time: e.when * 1000,
              title: e.what,
              tags: tags,
              text: e.data,
            });
          }

          return list;
        }
      );
    }
  };

  this.events = function(options) {
    try {
      var tags = '';
      if (options.tags) {
        tags = '&tags=' + options.tags;
      }
      return this.doGraphiteRequest({
        method: 'GET',
        url:
          '/events/get_data?from=' +
          this.translateTime(options.range.from, false) +
          '&until=' +
          this.translateTime(options.range.to, true) +
          tags,
      });
    } catch (err) {
      return $q.reject(err);
    }
  };

  this.targetContainsTemplate = function(target) {
    return templateSrv.variableExists(target.target);
  };

  this.translateTime = function(date, roundUp) {
    if (_.isString(date)) {
      if (date === 'now') {
        return 'now';
      } else if (date.indexOf('now-') >= 0 && date.indexOf('/') === -1) {
        date = date.substring(3);
        date = date.replace('m', 'min');
        date = date.replace('M', 'mon');
        return date;
      }
      date = dateMath.parse(date, roundUp);
    }

    // graphite' s from filter is exclusive
    // here we step back one minute in order
    // to guarantee that we get all the data that
    // exists for the specified range
    if (roundUp) {
      if (date.get('s')) {
        date.add(1, 'm');
      }
    } else if (roundUp === false) {
      if (date.get('s')) {
        date.subtract(1, 'm');
      }
    }

    return date.unix();
  };

  this.metricFindQuery = function(query, optionalOptions) {
    let options = optionalOptions || {};
    let interpolatedQuery = templateSrv.replace(query);

    let httpOptions: any = {
      method: 'GET',
      url: '/metrics/find',
      params: {
        query: interpolatedQuery,
      },
      // for cancellations
      requestId: options.requestId,
    };

    if (options && options.range) {
      httpOptions.params.from = this.translateTime(options.range.from, false);
      httpOptions.params.until = this.translateTime(options.range.to, true);
    }

    return this.doGraphiteRequest(httpOptions).then(results => {
      return _.map(results.data, metric => {
        return {
          text: metric.text,
          expandable: metric.expandable ? true : false,
        };
      });
    });
  };

  this.getTags = function(optionalOptions) {
    let options = optionalOptions || {};

    let httpOptions: any = {
      method: 'GET',
      url: '/tags',
      // for cancellations
      requestId: options.requestId,
    };

    if (options && options.range) {
      httpOptions.params.from = this.translateTime(options.range.from, false);
      httpOptions.params.until = this.translateTime(options.range.to, true);
    }

    return this.doGraphiteRequest(httpOptions).then(results => {
      return _.map(results.data, tag => {
        return {
          text: tag.tag,
          id: tag.id,
        };
      });
    });
  };

  this.getTagValues = function(tag, optionalOptions) {
    let options = optionalOptions || {};

    let httpOptions: any = {
      method: 'GET',
      url: '/tags/' + tag,
      // for cancellations
      requestId: options.requestId,
    };

    if (options && options.range) {
      httpOptions.params.from = this.translateTime(options.range.from, false);
      httpOptions.params.until = this.translateTime(options.range.to, true);
    }

    return this.doGraphiteRequest(httpOptions).then(results => {
      if (results.data && results.data.values) {
        return _.map(results.data.values, value => {
          return {
            text: value.value,
            id: value.id,
          };
        });
      } else {
        return [];
      }
    });
  };

  this.getTagsAutoComplete = (expression, tagPrefix) => {
    let httpOptions: any = {
      method: 'GET',
      url: '/tags/autoComplete/tags',
      params: {
        expr: expression,
      },
    };

    if (tagPrefix) {
      httpOptions.params.tagPrefix = tagPrefix;
    }

    return this.doGraphiteRequest(httpOptions).then(results => {
      if (results.data) {
        return _.map(results.data, tag => {
          return { text: tag };
        });
      } else {
        return [];
      }
    });
  };

  this.getTagValuesAutoComplete = (expression, tag, valuePrefix) => {
    let httpOptions: any = {
      method: 'GET',
      url: '/tags/autoComplete/values',
      params: {
        expr: expression,
        tag: tag,
      },
    };

    if (valuePrefix) {
      httpOptions.params.valuePrefix = valuePrefix;
    }

    return this.doGraphiteRequest(httpOptions).then(results => {
      if (results.data) {
        return _.map(results.data, value => {
          return { text: value };
        });
      } else {
        return [];
      }
    });
  };

  this.getVersion = function() {
    let httpOptions = {
      method: 'GET',
      url: '/version/_', // Prevent last / trimming
    };

    return this.doGraphiteRequest(httpOptions)
      .then(results => {
        if (results.data) {
          let semver = new SemVersion(results.data);
          return semver.isValid() ? results.data : '';
        }
        return '';
      })
      .catch(() => {
        return '';
      });
  };

  this.testDatasource = function() {
    return this.metricFindQuery('*').then(function() {
      return { status: 'success', message: 'Data source is working' };
    });
  };

  this.doGraphiteRequest = function(options) {
    if (this.basicAuth || this.withCredentials) {
      options.withCredentials = true;
    }
    if (this.basicAuth) {
      options.headers = options.headers || {};
      options.headers.Authorization = this.basicAuth;
    }

    options.url = this.url + options.url;
    options.inspect = { type: 'graphite' };

    return backendSrv.datasourceRequest(options);
  };

  this._seriesRefLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  this.buildGraphiteParams = function(options, scopedVars) {
    var graphite_options = [
      'from',
      'until',
      'rawData',
      'format',
      'maxDataPoints',
      'cacheTimeout',
    ];
    var clean_options = [],
      targets = {};
    var target, targetValue, i;
    var regex = /\#([A-Z])/g;
    var intervalFormatFixRegex = /'(\d+)m'/gi;
    var hasTargets = false;

    options['format'] = 'json';

    function fixIntervalFormat(match) {
      return match.replace('m', 'min').replace('M', 'mon');
    }

    for (i = 0; i < options.targets.length; i++) {
      target = options.targets[i];
      if (!target.target) {
        continue;
      }

      if (!target.refId) {
        target.refId = this._seriesRefLetters[i];
      }

      targetValue = templateSrv.replace(target.target, scopedVars);
      targetValue = targetValue.replace(
        intervalFormatFixRegex,
        fixIntervalFormat
      );
      targets[target.refId] = targetValue;
    }

    function nestedSeriesRegexReplacer(match, g1) {
      return targets[g1] || match;
    }

    for (i = 0; i < options.targets.length; i++) {
      target = options.targets[i];
      if (!target.target) {
        continue;
      }

      targetValue = targets[target.refId];
      targetValue = targetValue.replace(regex, nestedSeriesRegexReplacer);
      targets[target.refId] = targetValue;

      if (!target.hide) {
        hasTargets = true;
        clean_options.push('target=' + encodeURIComponent(targetValue));
      }
    }

    _.each(options, function(value, key) {
      if (_.indexOf(graphite_options, key) === -1) {
        return;
      }
      if (value) {
        clean_options.push(key + '=' + encodeURIComponent(value));
      }
    });

    if (!hasTargets) {
      return [];
    }

    return clean_options;
  };
}

function supportsTags(version: string): boolean {
  return isVersionGtOrEq(version, '1.1');
}
