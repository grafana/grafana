import _ from 'lodash';
import * as dateMath from 'app/core/utils/datemath';
import { isVersionGtOrEq, SemVersion } from 'app/core/utils/version';
import gfunc from './gfunc';

/** @ngInject */
export function GraphiteDatasource(instanceSettings, $q, backendSrv, templateSrv) {
  this.basicAuth = instanceSettings.basicAuth;
  this.url = instanceSettings.url;
  this.name = instanceSettings.name;
  this.graphiteVersion = instanceSettings.jsonData.graphiteVersion || '0.9';
  this.supportsTags = supportsTags(this.graphiteVersion);
  this.cacheTimeout = instanceSettings.cacheTimeout;
  this.withCredentials = instanceSettings.withCredentials;
  this.render_method = instanceSettings.render_method || 'POST';
  this.funcDefs = null;
  this.funcDefsPromise = null;

  this.getQueryOptionsInfo = function() {
    return {
      maxDataPoints: true,
      cacheTimeout: true,
      links: [
        {
          text: 'Help',
          url: 'http://docs.grafana.org/features/datasources/graphite/#using-graphite-in-grafana',
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

    this.addTracingHeaders(httpOptions, options);

    if (options.panelId) {
      httpOptions.requestId = this.name + '.panelId.' + options.panelId;
    }

    return this.doGraphiteRequest(httpOptions).then(this.convertDataPointsToMs);
  };

  this.addTracingHeaders = function(httpOptions, options) {
    var proxyMode = !this.url.match(/^http/);
    if (proxyMode) {
      httpOptions.headers['X-Dashboard-Id'] = options.dashboardId;
      httpOptions.headers['X-Panel-Id'] = options.panelId;
    }
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
      return this.events({ range: options.rangeRaw, tags: tags }).then(results => {
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
      });
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

    // special handling for tag_values(<tag>[,<expression>]*), this is used for template variables
    let matches = interpolatedQuery.match(/^tag_values\(([^,]+)((, *[^,]+)*)\)$/);
    if (matches) {
      const expressions = [];
      const exprRegex = /, *([^,]+)/g;
      let match;
      while ((match = exprRegex.exec(matches[2])) !== null) {
        expressions.push(match[1]);
      }
      options.limit = 10000;
      return this.getTagValuesAutoComplete(expressions, matches[1], undefined, options);
    }

    // special handling for tags(<expression>[,<expression>]*), this is used for template variables
    matches = interpolatedQuery.match(/^tags\(([^,]*)((, *[^,]+)*)\)$/);
    if (matches) {
      const expressions = [];
      if (matches[1]) {
        expressions.push(matches[1]);
        const exprRegex = /, *([^,]+)/g;
        let match;
        while ((match = exprRegex.exec(matches[2])) !== null) {
          expressions.push(match[1]);
        }
      }
      options.limit = 10000;
      return this.getTagsAutoComplete(expressions, undefined, options);
    }

    let httpOptions: any = {
      method: 'GET',
      url: '/metrics/find',
      params: {
        query: interpolatedQuery,
      },
      // for cancellations
      requestId: options.requestId,
    };

    if (options.range) {
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

    if (options.range) {
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
      url: '/tags/' + templateSrv.replace(tag),
      // for cancellations
      requestId: options.requestId,
    };

    if (options.range) {
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

  this.getTagsAutoComplete = (expressions, tagPrefix, optionalOptions) => {
    let options = optionalOptions || {};

    let httpOptions: any = {
      method: 'GET',
      url: '/tags/autoComplete/tags',
      params: {
        expr: _.map(expressions, expression => templateSrv.replace((expression || '').trim())),
      },
      // for cancellations
      requestId: options.requestId,
    };

    if (tagPrefix) {
      httpOptions.params.tagPrefix = tagPrefix;
    }
    if (options.limit) {
      httpOptions.params.limit = options.limit;
    }
    if (options.range) {
      httpOptions.params.from = this.translateTime(options.range.from, false);
      httpOptions.params.until = this.translateTime(options.range.to, true);
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

  this.getTagValuesAutoComplete = (expressions, tag, valuePrefix, optionalOptions) => {
    let options = optionalOptions || {};

    let httpOptions: any = {
      method: 'GET',
      url: '/tags/autoComplete/values',
      params: {
        expr: _.map(expressions, expression => templateSrv.replace((expression || '').trim())),
        tag: templateSrv.replace((tag || '').trim()),
      },
      // for cancellations
      requestId: options.requestId,
    };

    if (valuePrefix) {
      httpOptions.params.valuePrefix = valuePrefix;
    }
    if (options.limit) {
      httpOptions.params.limit = options.limit;
    }
    if (options.range) {
      httpOptions.params.from = this.translateTime(options.range.from, false);
      httpOptions.params.until = this.translateTime(options.range.to, true);
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

  this.getVersion = function(optionalOptions) {
    let options = optionalOptions || {};

    let httpOptions = {
      method: 'GET',
      url: '/version',
      requestId: options.requestId,
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

  this.createFuncInstance = function(funcDef, options?) {
    return gfunc.createFuncInstance(funcDef, options, this.funcDefs);
  };

  this.getFuncDef = function(name) {
    return gfunc.getFuncDef(name, this.funcDefs);
  };

  this.waitForFuncDefsLoaded = function() {
    return this.getFuncDefs();
  };

  this.getFuncDefs = function() {
    if (this.funcDefsPromise !== null) {
      return this.funcDefsPromise;
    }

    if (!supportsFunctionIndex(this.graphiteVersion)) {
      this.funcDefs = gfunc.getFuncDefs(this.graphiteVersion);
      this.funcDefsPromise = Promise.resolve(this.funcDefs);
      return this.funcDefsPromise;
    }

    let httpOptions = {
      method: 'GET',
      url: '/functions',
    };

    this.funcDefsPromise = this.doGraphiteRequest(httpOptions)
      .then(results => {
        if (results.status !== 200 || typeof results.data !== 'object') {
          this.funcDefs = gfunc.getFuncDefs(this.graphiteVersion);
        } else {
          this.funcDefs = gfunc.parseFuncDefs(results.data);
        }
        return this.funcDefs;
      })
      .catch(err => {
        console.log('Fetching graphite functions error', err);
        this.funcDefs = gfunc.getFuncDefs(this.graphiteVersion);
        return this.funcDefs;
      });

    return this.funcDefsPromise;
  };

  this.testDatasource = function() {
    let query = {
      panelId: 3,
      rangeRaw: { from: 'now-1h', to: 'now' },
      targets: [{ target: 'constantLine(100)' }],
      maxDataPoints: 300,
    };
    return this.query(query).then(function() {
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
    var graphite_options = ['from', 'until', 'rawData', 'format', 'maxDataPoints', 'cacheTimeout'];
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
      targetValue = targetValue.replace(intervalFormatFixRegex, fixIntervalFormat);
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

function supportsFunctionIndex(version: string): boolean {
  return isVersionGtOrEq(version, '1.1');
}
