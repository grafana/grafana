define([
  'angular',
  'lodash',
  'kbn',
  './zabbixAPIWrapper',
  './helperFunctions',
  './queryCtrl'
],
function (angular, _, kbn) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('ZabbixAPIDatasource', function($q, backendSrv, templateSrv, alertSrv, ZabbixAPI, zabbixHelperSrv) {

    /**
     * Datasource initialization. Calls when you refresh page, add
     * or modify datasource.
     *
     * @param {Object} datasource Grafana datasource object.
     */
    function ZabbixAPIDatasource(datasource) {
      this.name             = datasource.name;
      this.url              = datasource.url;
      this.basicAuth        = datasource.basicAuth;
      this.withCredentials  = datasource.withCredentials;

      if (datasource.jsonData) {
        this.username         = datasource.jsonData.username;
        this.password         = datasource.jsonData.password;

        // Use trends instead history since specified time
        this.trends           = datasource.jsonData.trends;
        this.trendsFrom       = datasource.jsonData.trendsFrom || '7d';

        // Limit metrics per panel for templated request
        this.limitmetrics     = datasource.jsonData.limitMetrics || 100;
      } else {
        // DEPRECATED. Loads settings from plugin.json file.
        // For backward compatibility only.
        this.username         = datasource.meta.username;
        this.password         = datasource.meta.password;
        this.trends           = datasource.meta.trends;
        this.trendsFrom       = datasource.meta.trendsFrom || '7d';
        this.limitmetrics     = datasource.meta.limitmetrics || 100;
      }

      // Initialize Zabbix API
      this.zabbixAPI = new ZabbixAPI(this.url, this.username, this.password, this.basicAuth, this.withCredentials);
    }

    /**
     * Test connection to Zabbix API
     *
     * @return {object} Connection status and Zabbix API version
     */
    ZabbixAPIDatasource.prototype.testDatasource = function() {
      var self = this;
      return this.zabbixAPI.getZabbixAPIVersion().then(function (apiVersion) {
        return self.zabbixAPI.performZabbixAPILogin().then(function (auth) {
          if (auth) {
            return {
              status: "success",
              title: "Success",
              message: "Zabbix API version: " + apiVersion
            };
          } else {
            return {
              status: "error",
              title: "Invalid user name or password",
              message: "Zabbix API version: " + apiVersion
            };
          }
        });
      });
    };

    /**
     * Calls for each panel in dashboard.
     *
     * @param  {Object} options   Query options. Contains time range, targets
     *                            and other info.
     *
     * @return {Object}           Grafana metrics object with timeseries data
     *                            for each target.
     */
    ZabbixAPIDatasource.prototype.query = function(options) {

      // get from & to in seconds
      var from = Math.ceil(kbn.parseDate(options.range.from).getTime() / 1000);
      var to = Math.ceil(kbn.parseDate(options.range.to).getTime() / 1000);
      var useTrendsFrom = Math.ceil(kbn.parseDate('now-' + this.trendsFrom).getTime() / 1000);

      // Create request for each target
      var promises = _.map(options.targets, function(target) {

        if (!target.ITService) {
          // Don't show undefined and hidden targets
          if (target.hide || !target.group || !target.host
            || !target.application || !target.item) {
            return [];
          }

          // Replace templated variables
          var groupname = templateSrv.replace(target.group.name, options.scopedVars);
          var hostname = templateSrv.replace(target.host.name, options.scopedVars);
          var appname = templateSrv.replace(target.application.name, options.scopedVars);
          var itemname = templateSrv.replace(target.item.name, options.scopedVars);

          // Extract zabbix groups, hosts and apps from string:
          // "{host1,host2,...,hostN}" --> [host1, host2, ..., hostN]
          var groups = zabbixHelperSrv.splitMetrics(groupname);
          var hosts = zabbixHelperSrv.splitMetrics(hostname);
          var apps = zabbixHelperSrv.splitMetrics(appname);

          // Remove hostnames from item names and then
          // extract item names
          // "hostname: itemname" --> "itemname"
          var delete_hostname_pattern = /(?:\[[\w\.]+]:\s)/g;
          var itemnames = zabbixHelperSrv.splitMetrics(itemname.replace(delete_hostname_pattern, ''));

          // Find items by item names and perform queries
          var self = this;
          return this.zabbixAPI.itemFindQuery(groups, hosts, apps)
            .then(function (items) {

              // Filter hosts by regex
              if (target.host.visible_name === 'All') {
                if (target.hostFilter && _.every(items, _.identity.hosts)) {

                  // Use templated variables in filter
                  var host_pattern = new RegExp(templateSrv.replace(target.hostFilter, options.scopedVars));
                  items = _.filter(items, function (item) {
                    return _.some(item.hosts, function (host) {
                      return host_pattern.test(host.name);
                    });
                  });
                }
              }

              if (itemnames[0] === 'All') {

                // Filter items by regex
                if (target.itemFilter) {

                  // Use templated variables in filter
                  var item_pattern = new RegExp(templateSrv.replace(target.itemFilter, options.scopedVars));
                  return _.filter(items, function (item) {
                    return item_pattern.test(zabbixHelperSrv.expandItemName(item));
                  });
                } else {
                  return items;
                }
              } else {

                // Filtering items
                return _.filter(items, function (item) {
                  return _.contains(itemnames, zabbixHelperSrv.expandItemName(item));
                });
              }
            }).then(function (items) {

              // Don't perform query for high number of items
              // to prevent Grafana slowdown
              if (items.length > self.limitmetrics) {
                var message = "Try to increase limitmetrics parameter in datasource config.<br>"
                  + "Current limitmetrics value is " + self.limitmetrics;
                alertSrv.set("Metrics limit exceeded", message, "warning", 10000);
                return [];
              } else {
                items = _.flatten(items);

                // Use alias only for single metric, otherwise use item names
                var alias = '';
                if (target.item.name === 'All' || itemnames.length > 1) {
                  alias = undefined;
                } else {
                  alias = templateSrv.replace(target.alias, options.scopedVars);
                }
                if ((from < useTrendsFrom) && self.trends) {
                  return self.zabbixAPI.getTrends(items, from, to)
                    .then(_.bind(zabbixHelperSrv.handleTrendResponse, zabbixHelperSrv, items, alias, target.scale));
                } else {
                  return self.zabbixAPI.getHistory(items, from, to)
                    .then(_.bind(zabbixHelperSrv.handleHistoryResponse, zabbixHelperSrv, items, alias, target.scale));
                }
              }
            });
        } else {
          // Don't show undefined and hidden targets
          if (target.hide || !target.itservice || !target.slaProperty) {
            return [];
          } else {
            return this.zabbixAPI.getSLA(target.itservice.serviceid, from, to)
              .then(_.bind(zabbixHelperSrv.handleSLAResponse, zabbixHelperSrv, target.itservice, target.slaProperty));
          }
        }
      }, this);

      return $q.all(_.flatten(promises)).then(function (results) {
        var timeseries_data = _.flatten(results);
        var data = _.map(timeseries_data, function (timeseries) {

          // Series downsampling
          if (timeseries.datapoints.length > options.maxDataPoints) {
            var ms_interval = Math.floor((to - from) / options.maxDataPoints) * 1000;
            timeseries.datapoints = zabbixHelperSrv.downsampleSeries(timeseries.datapoints, to, ms_interval);
          }
          return timeseries;
        });
        return { data: data };
      });
    };

    ////////////////
    // Templating //
    ////////////////

    /**
     * Find metrics from templated request.
     *
     * @param  {string} query Query from Templating
     * @return {string}       Metric name - group, host, app or item or list
     *                        of metrics in "{metric1,metcic2,...,metricN}" format.
     */
    ZabbixAPIDatasource.prototype.metricFindQuery = function (query) {
      // Split query. Query structure:
      // group.host.app.item
      var parts = [];
      _.each(query.split('.'), function (part) {
        part = templateSrv.replace(part);
        if (part[0] === '{') {
          // Convert multiple mettrics to array
          // "{metric1,metcic2,...,metricN}" --> [metric1, metcic2,..., metricN]
          parts.push(zabbixHelperSrv.splitMetrics(part));
        } else {
          parts.push(part);
        }
      });
      var template = _.object(['group', 'host', 'app', 'item'], parts);

      // Get items
      if (parts.length === 4) {
        return this.zabbixAPI.itemFindQuery(template.group, template.host, template.app)
          .then(function (result) {
            return _.map(result, function (item) {
              var itemname = zabbixHelperSrv.expandItemName(item);
              return {
                text: itemname,
                expandable: false
              };
            });
          });
      }
      // Get applications
      else if (parts.length === 3) {
        return this.zabbixAPI.appFindQuery(template.host, template.group).then(function (result) {
          return _.map(result, function (app) {
            return {
              text: app.name,
              expandable: false
            };
          });
        });
      }
      // Get hosts
      else if (parts.length === 2) {
        return this.zabbixAPI.hostFindQuery(template.group).then(function (result) {
          return _.map(result, function (host) {
            return {
              text: host.name,
              expandable: false
            };
          });
        });
      }
      // Get groups
      else if (parts.length === 1) {
        return this.zabbixAPI.getGroupByName(template.group).then(function (result) {
          return _.map(result, function (hostgroup) {
            return {
              text: hostgroup.name,
              expandable: false
            };
          });
        });
      }
      // Return empty object for invalid request
      else {
        var d = $q.defer();
        d.resolve([]);
        return d.promise;
      }
    };

    /////////////////
    // Annotations //
    /////////////////

    ZabbixAPIDatasource.prototype.annotationQuery = function(annotation, rangeUnparsed) {
      var from = Math.ceil(kbn.parseDate(rangeUnparsed.from).getTime() / 1000);
      var to = Math.ceil(kbn.parseDate(rangeUnparsed.to).getTime() / 1000);
      var self = this;

      var params = {
        output: ['triggerid', 'description'],
        search: {
          'description': annotation.query
        },
        searchWildcardsEnabled: true,
        expandDescription: true
      };

      return this.zabbixAPI.performZabbixAPIRequest('trigger.get', params)
        .then(function (result) {
          if(result) {
            var objects = _.indexBy(result, 'triggerid');
            var params = {
              output: 'extend',
              time_from: from,
              time_till: to,
              objectids: _.keys(objects),
              select_acknowledges: 'extend'
            };

            // Show problem events only
            if (!annotation.showOkEvents) {
              params.value = 1;
            }

            return self.zabbixAPI.performZabbixAPIRequest('event.get', params)
              .then(function (result) {
                var events = [];
                _.each(result, function(e) {
                  var formatted_acknowledges = zabbixHelperSrv.formatAcknowledges(e.acknowledges);
                  events.push({
                    annotation: annotation,
                    time: e.clock * 1000,
                    title: Number(e.value) ? 'Problem' : 'OK',
                    text: objects[e.objectid].description + formatted_acknowledges
                  });
                });
                return events;
              });
          } else {
            return [];
          }
        });
    };

    return ZabbixAPIDatasource;
  });
});
