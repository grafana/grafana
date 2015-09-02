define([
    'angular',
    'lodash',
    'kbn',
    'moment',
    './directives',
    './queryCtrl',
  ],
  function (angular, _, kbn) {
    'use strict';

    var module = angular.module('grafana.services');

    module.factory('AtsdDatasource', function ($q, backendSrv, templateSrv) {

      function AtsdDatasource(datasource) {
        this.type = 'atsd';

        this.url = datasource.url;
        this.basicAuth = datasource.basicAuth;

        this.name = datasource.name;
        this.supportMetrics = true;

        this.cache = 300000;

        this.recent = {};
        this.recentTags = {};
      }

      AtsdDatasource.prototype.dropCache = function () {
        this.recent = {};
        this.recentTags = {};
        console.log('cache dropped');
      };

      AtsdDatasource.prototype.query = function (options) {
        console.log('options: ' + JSON.stringify(options));

        var start = _convertToAtsdTime(options.range.from);
        var end = _convertToAtsdTime(options.range.to);
        var qs = [];

        _.each(options.targets, function (target) {
          target.disconnect = options.targets[0].disconnect;
          qs.push(_convertTargetToQuery(target));
        });

        var queries = _.compact(qs);

        if (_.isEmpty(queries)) {
          var d = $q.defer();
          d.resolve({ data: [] });
          return d.promise;
        }

        var groupByTags = {};

        _.each(queries, function (query) {
          _.each(query.tags, function (val, key) {
            groupByTags[key] = true;
          });
        });

        return this._performTimeSeriesQuery(queries, start, end).then(function (response) {

          if (response.data === undefined) {
            return { data: [] };
          }

          var disconnect = queries[0].disconnect;

          var result = _.map(response.data, function (metricData) {
            return _transformMetricData(metricData, disconnect);
          })[0];

          result.sort(function (a, b) {
            var nameA = a.target.toLowerCase();
            var nameB = b.target.toLowerCase();

            if (nameA < nameB) {
              return -1;
            } else if (nameA > nameB) {
              return 1;
            } else {
              return 0;
            }
          });

          return { data: result };
        });
      };

      AtsdDatasource.prototype._performTimeSeriesQuery = function (queries, start, end) {
        var tsQueries = [];

        _.each(queries, function (query) {
          if (query.entity !== '' && query.metric !== '') {
            if (query.implicit) {
              if (query.tagCombos !== undefined) {
                _.each(query.tagCombos, function (group) {
                  if (group.en) {
                    var tags = {};

                    _.each(group.data, function (value, key) {
                      tags[key] = [value];
                    });

                    tsQueries.push(
                      {
                        startDate: start,
                        endDate: end,
                        limit: 10000,
                        entity: query.entity,
                        metric: query.metric,
                        tags: tags,
                        aggregate: {
                          type: query.statistic.toUpperCase(),
                          interval: {
                            count: query.period.count,
                            unit: query.period.unit
                          }
                        }
                      }
                    );
                  }
                });
              }
            } else {
              var tags = {};

              _.each(query.tags, function (value, key) {
                tags[key] = [value];
              });

              tsQueries.push(
                {
                  startDate: start,
                  endDate: end,
                  limit: 10000,
                  entity: query.entity,
                  metric: query.metric,
                  tags: tags,
                  aggregate: {
                    type: query.statistic.toUpperCase(),
                    interval: {
                      count: query.period.count,
                      unit: query.period.unit
                    }
                  }
                }
              );
            }
          }
        });

        if (tsQueries.length === 0) {
          var d = $q.defer();
          d.resolve({ data: undefined });
          return d.promise;
        }

        console.log('queries: ' + JSON.stringify(tsQueries));

        var options = {
          method: 'POST',
          url: this.url + '/api/v1/series',
          data: {
            queries: tsQueries
          },
          headers: {
            Authorization: this.basicAuth
          }
        };

        return backendSrv.datasourceRequest(options).then(function (result) {
          return result;
        });
      };

      AtsdDatasource.prototype.suggestEntities = function () {
        var so = this;

        if (!('entities' in so.recent) ||
          (new Date()).getTime() - so.recent['entities'].time > so.cache) {

          so.recent['entities'] = {
            time: (new Date()).getTime(),
            value: []
          };

          var options = {
            method: 'GET',
            url: so.url + '/api/v1/entities',
            headers: {
              Authorization: so.basicAuth
            }
          };

          return backendSrv.datasourceRequest(options).then(function (result) {
            if (result.status !== 200) {
              delete so.recent['entities'];
              return [];
            }

            var names = [];
            _.each(result.data, function (entity) {
              names.push(entity.name);
            });

            console.log('entities: ' + JSON.stringify(names));
            so.recent['entities'].value = names;

            return names;
          });
        } else {
          var d = $q.defer();
          d.resolve(so.recent['entities'].value);
          return d.promise;
        }
      };

      AtsdDatasource.prototype.suggestMetrics = function (entity) {
        var so = this;

        entity = entity !== undefined ? entity : '';

        var key = entity !== '' ?
          'entities/' + entity + '/metrics' :
          'metrics';

        if (!(key in so.recent) ||
          (new Date()).getTime() - so.recent[key].time > so.cache) {

          so.recent[key] = {
            time: (new Date()).getTime(),
            value: []
          };

          var options = {
            method: 'GET',
            url: so.url + '/api/v1/' + key,
            headers: {
              Authorization: so.basicAuth
            }
          };

          return backendSrv.datasourceRequest(options).then(function (result) {
            if (result.status !== 200) {
              delete so.recent[key];
              return [];
            }

            var names = [];
            _.each(result.data, function (metric) {
              names.push(metric.name);
            });

            console.log('metrics: ' + JSON.stringify(names));
            so.recent[key].value = names;

            return names;
          });

        } else {
          var d = $q.defer();
          d.resolve(so.recent[key].value);
          return d.promise;
        }
      };

      AtsdDatasource.prototype.suggestNextSegment = function (entity, segments) {
        segments = segments !== undefined ? segments : [];
        var query = segments.length > 0 ? segments.join('.') + '.' : '';

        return this.suggestMetrics(entity, query).then(function (names) {
          var tokens = [];

          var names_l = [];

          _.each(names, function (name) {
            if (name.substr(0, query.length) === query) {
              names_l.push(name);
            }
          });

          tokens = _.map(names_l, function (name) {
            return name.substr(query.length, name.length).split('.')[0];
          });

          tokens = tokens.filter(function (elem, pos) {
            return tokens.indexOf(elem) === pos;
          });

          return tokens;
        });
      };

      AtsdDatasource.prototype._queryTags = function (entity, metric) {
        var so = this;

        entity = entity !== undefined ? entity : '';
        metric = metric !== undefined ? metric : '';

        var d;
        if (entity === '' || metric === '') {
          d = $q.defer();
          d.resolve({ data: {} });
          return d.promise;
        }

        if (!(metric in so.recentTags) || !(entity in so.recentTags[metric]) ||
          (new Date()).getTime() - so.recentTags[metric][entity].time > so.cache) {

          if (!(metric in so.recentTags)) {
            so.recentTags[metric] = {};
          }

          so.recentTags[metric][entity] = {
            time: (new Date()).getTime(),
            value: {}
          };

          var options = {
            method: 'GET',
            url: so.url + '/api/v1/metrics/' + metric + '/entity-and-tags',
            headers: {
              Authorization: so.basicAuth
            }
          };

          return backendSrv.datasourceRequest(options).then(function (result) {
            if (result.status !== 200) {
              delete so.recentTags[metric][entity];
              return { data: {} };
            }

            so.recentTags[metric][entity].value = result;
            return result;
          });
        } else {
          d = $q.defer();
          d.resolve(so.recentTags[metric][entity].value);
          return d.promise;
        }
      };

      AtsdDatasource.prototype._suggestTags = function (entity, metric, tags_known) {
        tags_known = tags_known !== undefined ? tags_known : {};

        return this._queryTags(entity, metric).then(function (result) {

          var tags = {};
          _.each(result.data, function (entry) {
            if (entry.entity === entity) {
              var matched = true;

              _.each(entry.tags, function (value, key) {
                if (key in tags_known && value !== tags_known[key]) {
                  matched = false;
                }
              });

              if (matched) {
                _.each(entry.tags, function (value, key) {
                  if (!(key in tags_known)) {
                    if (key in tags) {
                      tags[key].push(value);
                    } else {
                      tags[key] = [value];
                    }
                  }
                });
              }
            }
          });

          _.each(tags, function (values, key) {
            tags[key] = values.filter(function (elem, pos) {
              return values.indexOf(elem) === pos;
            });
          });

          return tags;
        });
      };

      AtsdDatasource.prototype.suggestTagKeys = function (entity, metric, tags_known) {
        return this._suggestTags(entity, metric, tags_known).then(function (tags) {
          var keys = _.map(tags, function (values, key) {
            return key;
          });
          console.log('tag keys: ' + JSON.stringify(keys));
          return keys;
        });
      };

      AtsdDatasource.prototype.suggestTagValues = function (entity, metric, tags_known, name) {
        name = name !== undefined ? name : '';

        return this._suggestTags(entity, metric, tags_known).then(function (tags) {
          console.log('tag values: ' + JSON.stringify(tags[name]));
          if (name in tags) {
            return tags[name];
          } else {
            return [];
          }
        });
      };

      AtsdDatasource.prototype.getTags = function (entity, metric) {
        return this._queryTags(entity, metric).then(function (result) {
          var tags = [];
          _.each(result.data, function (entry) {
            if (entry.entity === entity) {
              tags.push(entry.tags);
            }
          });
          console.log('tags: ' + JSON.stringify(tags));
          return tags;
        });
      };

      AtsdDatasource.prototype.testDatasource = function () {
        var options = {
          method: 'POST',
          url: this.url + '/api/v1/series',
          data: {
            queries: []
          },
          headers: {
            Authorization: this.basicAuth
          }
        };

        return backendSrv.datasourceRequest(options).then(function () {
          return { status: "success", message: "Data source is working", title: "Success" };
        });
      };

      function _transformMetricData(metricData, disconnect) {
        var dps;
        var ret = [];

        _.each(metricData, function (dataset) {
          dps = [];

          if (disconnect > 0) {
            if (dataset.data.length > 0) {
              dps.push([dataset.data[0].v, dataset.data[0].t]);

              for (var i = 1; i < dataset.data.length; i++) {
                if (dataset.data[i].t - dataset.data[i - 1].t > disconnect * 1000) {
                  dps.push([null, dataset.data[i - 1].t + 1]);
                  dps.push([null, dataset.data[i].t - 1]);
                }

                dps.push([dataset.data[i].v, dataset.data[i].t]);
              }
            }
          } else {
            _.each(dataset.data, function (data) {
              dps.push([data.v, data.t]);
            });
          }

          var name = dataset.entity + ': ' + dataset.metric;

          _.each(dataset.tags, function (value, key) {
            name += ', ' + key + '=' + value;
          });

          ret.push({ target: name, datapoints: dps });
        });

        return ret;
      }

      function _parsePeriod(period) {
        var count = '';
        var unit;

        for (var i = 0; i < period.length; i++) {
          var c = period.charAt(i);

          if (!isNaN(c)) {
            count += c;
          } else {
            unit = c;

            switch (unit) {
              case 'y':
                unit = 'YEAR';
                break;
              case 'M':
                unit = 'MONTH';
                break;
              case 'w':
                unit = 'WEEK';
                break;
              case 'd':
                unit = 'DAY';
                break;
              case 'h':
              case 'H':
                unit = 'HOUR';
                break;
              case 'm':
                unit = 'MINUTE';
                break;
              case 's':
                unit = 'SECOND';
                break;
              default:
                unit = '';
            }

            break;
          }
        }

        return { count: parseInt(count), unit: unit };
      }

      function _convertToSeconds(interval) {
        var count = interval.count;

        switch (interval.unit) {
          case 'YEAR':
            count *= 365 * 24 * 60 * 60;
            break;
          case 'MONTH':
            count *= 30 * 24 * 60 * 60;
            break;
          case 'WEEK':
            count *= 7 * 24 * 60 * 60;
            break;
          case 'DAY':
            count *= 24 * 60 * 60;
            break;
          case 'HOUR':
            count *= 60 * 60;
            break;
          case 'MINUTE':
            count *= 60;
            break;
          case 'SECOND':
            break;
          default:
            count = 0;
        }

        return count;
      }

      function _convertTargetToQuery(target) {
        if (!target.metric || !target.entity || target.hide) {
          return null;
        }

        var query = {
          entity: templateSrv.replace(target.entity),
          metric: templateSrv.replace(target.metric),

          statistic: target.statistic !== undefined ? templateSrv.replace(target.statistic) : 'detail',
          period: (target.period !== undefined && target.period !== '') ? _parsePeriod(target.period) : { count: 1, unit: 'DAY'},

          tags: angular.copy(target.tags),
          tagCombos: angular.copy(target.tagCombos),
          implicit: angular.copy(target.implicit),

          disconnect: (target.disconnect !== undefined && target.disconnect !== '') ?
            _convertToSeconds(_parsePeriod(target.disconnect)) :
            24 * 60 * 60
        };

        return query;
      }

      function _convertToAtsdTime(date) {
        date = date !== 'now' ? date : new Date();
        date = kbn.parseDate(date);

        return date.toISOString();
      }

      return AtsdDatasource;
    });

  });