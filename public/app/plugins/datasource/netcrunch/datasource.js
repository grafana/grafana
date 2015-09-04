/***************************************************************
 *
 * Author   : boguslaw.gorczyca
 * Created  : 2015-08-20
 *
 * 2015 Copyright AdRem Software, all rights reserved
 *
 ****************************************************************/

define([
  'angular',
  'lodash',
  'moment',
  'config',
  'jquery',
  'kbn',
  './services/networkDataProvider',
  './services/countersDataProvider',
  './services/chartDataProvider',
  './services/processingDataWorker',
  './controllers/netCrunchQueryCtrl',
  './filters/netCrunchFilters'
],

function (angular, _, moment, config, $, kbn) {

  'use strict';

  var module = angular.module('grafana.services');

  module.factory('NetCrunchDatasource', function($q, $rootScope, adrem, netCrunchRemoteSession,
                                                 networkDataProvider, atlasTree, countersDataProvider,
                                                 chartDataProvider, netCrunchOrderNodesFilter,
                                                 netCrunchMapNodesFilter, netCrunchNodesFilter,
                                                 processingDataWorker) {

    var THREAD_WORKER_NODES_NUMBER = 1000;

    function NetCrunchDatasource(datasource) {

      var initTask = $q.defer(),
          nodesReady = $q.defer(),
          networkAtlasReady = $q.defer(),
          self = this;

      this.id = datasource.id;
      this.name = datasource.name;
      this.url = datasource.url;
      this.username = datasource.username;
      this.password = datasource.password;
      this.ready = initTask.promise;
      this.nodes = nodesReady.promise;
      this.networkAtlas = networkAtlasReady.promise;

      netCrunchRemoteSession.init().then(function(status) {
        var LOGIN_STATUS_ID = 0;

        if (status[LOGIN_STATUS_ID] === true) {
          networkDataProvider.init().then(function(){

            $rootScope.$on('host-data-changed', function() {
              var nodes = atlasTree.nodes;

              nodes.table = [];
              Object.keys(nodes).forEach(function(nodeId){
                nodes.table.push(nodes[nodeId]);
              });

              self.updateNodeList(nodes.table).then(function(updated) {
                nodesReady.resolve(updated);
                $rootScope.$broadcast('netCrunch-datasource-hosts-changed');
              });
            });

            $rootScope.$on('network-data-changed', function() {
              networkAtlasReady.resolve(atlasTree.tree);
              $rootScope.$broadcast('netCrunch-datasource-network-atlas-changed');
            });

            initTask.resolve();
          });
        } else {
          console.log('NetCrunch datasource: login failed');
          initTask.reject();
        }
      });
    }

    NetCrunchDatasource.prototype.testDatasource = function() {
      var defer = $q.defer();

      if ((adrem.ncSrv != null) && (adrem.Client.loggedIn === true)) {
        defer.resolve({ status: "success", message: "Data source connection is working",
                        title: "Success" });
        return defer.promise;
      } else {
        return $q.when({ status: "error", message: "Data source connection is not working",
                         title: "Error" });
      }
    };

    NetCrunchDatasource.prototype.getNodeById = function (nodeID) {
      return this.nodes.then(function(nodes) {
        return nodes.nodesMap[nodeID];
      });
    };

    NetCrunchDatasource.prototype.getCounters = function (nodeId) {
      return this.ready.then(function(){
        return countersDataProvider.getCounters(nodeId).then(function(counters){
          return countersDataProvider.prepareCountersForMonitors(counters).then(function(counters){

            counters.table = [];
            Object.keys(counters).forEach(function(monitorID) {
              if (monitorID > 0) {
                counters[monitorID].counters.forEach(function(counter) {
                  counters.table.push(counter);
                });
              }
            });

            return counters;
          });
        });
      });
    };

    NetCrunchDatasource.prototype.findCounterByName = function(counters, counterName){
      var existingCounter = null;

      counters.table.some(function(counter){
        if (counter.name === counterName) {
          existingCounter = counter;
          return true;
        } else {
          return false;
        }
      });

      return existingCounter;
    };

    NetCrunchDatasource.prototype.filterNodeList = function(nodes, pattern) {

      var newNodeList = [],
        result = $q.when(newNodeList);

      function orderNodeList(nodes) {
        if (nodes != null) {
          return netCrunchOrderNodesFilter(nodes);
        } else {
          return [];
        }
      }

      if (nodes != null) {
        if (nodes.length < THREAD_WORKER_NODES_NUMBER) {
          newNodeList = netCrunchMapNodesFilter(nodes, null);
          newNodeList = orderNodeList(newNodeList);
          newNodeList = netCrunchNodesFilter(newNodeList, pattern);
          result = $q.when(newNodeList);
        } else {
          return processingDataWorker.filterAndOrderMapNodes(nodes, null).then(function(result){
            return netCrunchNodesFilter(result, pattern);
          });
        }
      }

      return result;
    };

    NetCrunchDatasource.prototype.updateNodeList = function(nodes) {
      return this.filterNodeList(nodes, '').then(function(updated){
        updated.nodesMap = Object.create(null);
        updated.forEach(function(node){
          updated.nodesMap[node.values.Id] = node;
        });
        return updated;
      });
    };

//***** BEGIN MODIFICATION AREA *****
    NetCrunchDatasource.prototype.query = function(options) {
      try {

        return this.ready.then(function() {

          var datasource=this,
            targets=options.targets || [],
            rangeFrom=kbn.parseDate(options.range.from),//round time to minute
            rangeTo=kbn.parseDate(options.range.to),
            counterSeries=Object.create(null),
            dataQueries=[];

          targets.forEach(function ( target ) {

            if ((target.hide !== true) && (target.counterDataComplete === true)) {
              dataQueries.push(
                chartDataProvider.getCounterData(target.nodeID, target.counterName,
                                                 rangeFrom, rangeTo).data

              );
            }
          });


          return $q.all(dataQueries).then(function ( series ) {
            var hidden=0;
                counterSeries.data=[];

            if (series.length > 0) {
              targets.forEach(function ( target, $index ) {
                if (target.hide !== true) {

                  if (($index - hidden) < series.length) {
                    counterSeries.data.push(
                      {
                        target: target.localVars.nodeName + ' - ' + target.localVars.counterDisplayName,
                        datapoints: chartDataProvider.grafanaDataConverter(series[$index - hidden])
                      }
                    );
                  }

                } else {
                  hidden+=1;
                }

              });
              //console.log(counterSeries);
            }
            //console.log(series);
            return counterSeries;
          });

        }, function(){
                return $q.when(false);
              }
        );

        //return $q.when(false);
      //  //, moment(), 0, 30, {ResultMask: [['tqrAvg']]}).
      //.then(function ( result ) {
      //    //console.log(result);
      //    //console.log(chartDataProvider.grafanaDataConverter(result));
      //    myData.data[0].datapoints=chartDataProvider.grafanaDataConverter(result);
      //    return myData;
      //  });

/*
        console.log(options);
        return this.ready.then(function() {

          console.log('query data');

          //self.getCounters('1001').then(function(counters){ console.log(counters); });

          return chartDataProvider.getCounterData(1002, 'PING|Check Time',
                                                  options.range.from, options.range.to).data
            //, moment(), 0, 30, {ResultMask: [['tqrAvg']]}).
            .then(function ( result ) {
                    //console.log(result);
                    //console.log(chartDataProvider.grafanaDataConverter(result));
                    myData.data[0].datapoints=chartDataProvider.grafanaDataConverter(result);
                    return myData;
                  });
          //{
          //  periodType : chartDataProvider.PERIOD_TYPE.tpHours,
          //    periodInterval : 1}
          /!*
                  netCrunchRemoteSession.queryTrendData(
                    '1001', // NodeId
                    'LogicalDisk|% Free Space|HarddiskVolume1', // Counter Path Object|Counter|Instance
                    0,   // Period type
                    60,                         // Period count here 1/2 hour
                    moment().day(-1),  // From date: 24h back thanks to sugar.js
                    moment(),              // To data: now
                    {ResultMask: [['tqrAvg']]}, // we just want avg possible is [ tqrAvg, tqrMin, tqrMax, tqrAvail, tqrDelta, tqrEqual, tqrDistr ]
                    null,                       // day mask just no mask
                    null                        // value for equal checking
                  //netCrunchRemoteSession.queryTrendData('7730',
                  //                                      'PING|Check Time',
                  //                                      0,
                  //                                      60,
                  //                                      moment().day(-1),
                  //                                      moment(),
                  //                                      {ResultMask: [['tqrAvg']]},
                  //                                      null,
                  //                                      null
                  ).then(function(data){
                           console.log(data);});
          *!/

        });
*/
      }
      catch(error) {
        return $q.reject(error);
      }

    };

      //client.queryTrendData(
      //  $scope.selectedNode.Id.toString(), // NodeId
      //  cnt, // Counter Path Object|Counter|Instance
      //  ANALYZE_PERIOD.tpMinutes,   // Period type
      //  30,                         // Period count here 1/2 hour
      //  Date.create().addDays(-1),  // From date: 24h back thanks to sugar.js
      //  Date.create(),              // To data: now
      //  {ResultMask: [['tqrAvg']]}, // we just want avg possible is [ tqrAvg, tqrMin, tqrMax, tqrAvail, tqrDelta, tqrEqual, tqrDistr ]
      //  null,                       // day mask just no mask
      //  null                        // value for equal checking
      //)
      //  .then(function (data) {
      //          $scope.chartData.datasets[0].data = data.trend;
      //        });


      //return $q.when(myData);
      //try {
      //  var graphOptions = {
      //    from: this.translateTime(options.range.from, 'round-down'),
      //    until: this.translateTime(options.range.to, 'round-up'),
      //    targets: options.targets,
      //    format: options.format,
      //    cacheTimeout: options.cacheTimeout || this.cacheTimeout,
      //    maxDataPoints: options.maxDataPoints,
      //  };

      //  var params = this.buildGraphiteParams(graphOptions, options.scopedVars);
      //
      //  if (options.format === 'png') {
      //    return $q.when(this.url + '/render' + '?' + params.join('&'));
      //  }
      //
      //  var httpOptions = { method: this.render_method, url: '/render' };
      //
      //  if (httpOptions.method === 'GET') {
      //    httpOptions.url = httpOptions.url + '?' + params.join('&');
      //  }
      //  else {
      //    httpOptions.data = params.join('&');
      //    httpOptions.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
      //  }
      //
      //  return this.doGraphiteRequest(httpOptions).then(this.convertDataPointsToMs);
      //}
      //catch(err) {
      //  return $q.reject(err);
      //}
    //};

//****** END MODIFICATION AREA ******


    $rootScope.$on('netCrunch-datasource-hosts-changed', function(){
      //console.log('hosts changed');
      //console.log(atlasTree.nodes);

    });

    $rootScope.$on('netCrunch-datasource-network-atlas-changed', function(){
      //console.log('network atlas changed');
    });

    //**** backendSrv, templateSrv,
    /* NetCrunch Datasource config in database
     0, 1,  0,  netcrunch,  "Main NetCrunch Datasource",  proxy,  http://192.168.3.56/ncapi/,
     aqqaqq,  Admin,, 0,,,  1,  null, "2015-08-19 12:08:46",  "2015-08-20 08:37:06"
     */

    //NetCrunchDatasource.prototype._request = function(method, url, index, data) {
    //  var options = {
    //    url: this.url + "/" + index + url,
    //    method: method,
    //    data: data
    //  };
    //
    //  if (this.basicAuth) {
    //    options.withCredentials = true;
    //    options.headers = {
    //      "Authorization": this.basicAuth
    //    };
    //  }
    //
    //  return backendSrv.datasourceRequest(options);
    //};
    //
    //NetCrunchDatasource.prototype._get = function(url) {
    //  return this._request('GET', url, this.index)
    //    .then(function(results) {
    //      return results.data;
    //    });
    //};
    //
    //NetCrunchDatasource.prototype._post = function(url, data) {
    //  return this._request('POST', url, this.index, data)
    //    .then(function(results) {
    //      return results.data;
    //    });
    //};
    //
    //NetCrunchDatasource.prototype.annotationQuery = function(annotation, rangeUnparsed) {
    //  var range = {};
    //  var timeField = annotation.timeField || '@timestamp';
    //  var queryString = annotation.query || '*';
    //  var tagsField = annotation.tagsField || 'tags';
    //  var titleField = annotation.titleField || 'desc';
    //  var textField = annotation.textField || null;
    //
    //  range[timeField]= {
    //    from: rangeUnparsed.from,
    //    to: rangeUnparsed.to,
    //  };
    //
    //  var queryInterpolated = templateSrv.replace(queryString);
    //  var filter = { "bool": { "must": [{ "range": range }] } };
    //  var query = { "bool": { "should": [{ "query_string": { "query": queryInterpolated } }] } };
    //  var data = {
    //    "fields": [timeField, "_source"],
    //    "query" : { "filtered": { "query" : query, "filter": filter } },
    //    "size": 10000
    //  };
    //
    //  return this._request('POST', '/_search', annotation.index, data).then(function(results) {
    //    var list = [];
    //    var hits = results.data.hits.hits;
    //
    //    var getFieldFromSource = function(source, fieldName) {
    //      if (!fieldName) { return; }
    //
    //      var fieldNames = fieldName.split('.');
    //      var fieldValue = source;
    //
    //      for (var i = 0; i < fieldNames.length; i++) {
    //        fieldValue = fieldValue[fieldNames[i]];
    //        if (!fieldValue) {
    //          console.log('could not find field in annotatation: ', fieldName);
    //          return '';
    //        }
    //      }
    //
    //      if (_.isArray(fieldValue)) {
    //        fieldValue = fieldValue.join(', ');
    //      }
    //      return fieldValue;
    //    };
    //
    //    for (var i = 0; i < hits.length; i++) {
    //      var source = hits[i]._source;
    //      var fields = hits[i].fields;
    //      var time = source[timeField];
    //
    //      if (_.isString(fields[timeField]) || _.isNumber(fields[timeField])) {
    //        time = fields[timeField];
    //      }
    //
    //      var event = {
    //        annotation: annotation,
    //        time: moment.utc(time).valueOf(),
    //        title: getFieldFromSource(source, titleField),
    //        tags: getFieldFromSource(source, tagsField),
    //        text: getFieldFromSource(source, textField)
    //      };
    //
    //      list.push(event);
    //    }
    //    return list;
    //  });
    //};
    //
    //NetCrunchDatasource.prototype._getDashboardWithSlug = function(id) {
    //  return this._get('/dashboard/' + kbn.slugifyForUrl(id))
    //    .then(function(result) {
    //      return angular.fromJson(result._source.dashboard);
    //    }, function() {
    //      throw "Dashboard not found";
    //    });
    //};
    //
    //NetCrunchDatasource.prototype.getDashboard = function(id, isTemp) {
    //  var url = '/dashboard/' + id;
    //  if (isTemp) { url = '/temp/' + id; }
    //
    //  var self = this;
    //  return this._get(url)
    //    .then(function(result) {
    //      return angular.fromJson(result._source.dashboard);
    //    }, function(data) {
    //      if(data.status === 0) {
    //        throw "Could not contact Elasticsearch. Please ensure that Elasticsearch is reachable from your browser.";
    //      } else {
    //        // backward compatible fallback
    //        return self._getDashboardWithSlug(id);
    //      }
    //    });
    //};
    //
    //NetCrunchDatasource.prototype.saveDashboard = function(dashboard) {
    //  var title = dashboard.title;
    //  var temp = dashboard.temp;
    //  if (temp) { delete dashboard.temp; }
    //
    //  var data = {
    //    user: 'guest',
    //    group: 'guest',
    //    title: title,
    //    tags: dashboard.tags,
    //    dashboard: angular.toJson(dashboard)
    //  };
    //
    //  if (temp) {
    //    return this._saveTempDashboard(data);
    //  }
    //  else {
    //
    //    var id = encodeURIComponent(kbn.slugifyForUrl(title));
    //    var self = this;
    //
    //    return this._request('PUT', '/dashboard/' + id, this.index, data)
    //      .then(function(results) {
    //        self._removeUnslugifiedDashboard(results, title, id);
    //        return { title: title, url: '/dashboard/db/' + id };
    //      }, function() {
    //        throw 'Failed to save to elasticsearch';
    //      });
    //  }
    //};
    //
    //NetCrunchDatasource.prototype._removeUnslugifiedDashboard = function(saveResult, title, id) {
    //  if (saveResult.statusText !== 'Created') { return; }
    //  if (title === id) { return; }
    //
    //  var self = this;
    //  this._get('/dashboard/' + title).then(function() {
    //    self.deleteDashboard(title);
    //  });
    //};
    //
    //NetCrunchDatasource.prototype._saveTempDashboard = function(data) {
    //  return this._request('POST', '/temp/?ttl=' + this.saveTempTTL, this.index, data)
    //    .then(function(result) {
    //
    //      var baseUrl = window.location.href.replace(window.location.hash,'');
    //      var url = baseUrl + "#dashboard/temp/" + result.data._id;
    //
    //      return { title: data.title, url: url };
    //
    //    }, function(err) {
    //      throw "Failed to save to temp dashboard to elasticsearch " + err.data;
    //    });
    //};
    //
    //NetCrunchDatasource.prototype.deleteDashboard = function(id) {
    //  return this._request('DELETE', '/dashboard/' + id, this.index)
    //    .then(function(result) {
    //      return result.data._id;
    //    }, function(err) {
    //      throw err.data;
    //    });
    //};
    //
    //NetCrunchDatasource.prototype.searchDashboards = function(queryString) {
    //  var endsInOpen = function(string, opener, closer) {
    //    var character;
    //    var count = 0;
    //    for (var i = 0, len = string.length; i < len; i++) {
    //      character = string[i];
    //
    //      if (character === opener) {
    //        count++;
    //      } else if (character === closer) {
    //        count--;
    //      }
    //    }
    //
    //    return count > 0;
    //  };
    //
    //  var tagsOnly = queryString.indexOf('tags!:') === 0;
    //  if (tagsOnly) {
    //    var tagsQuery = queryString.substring(6, queryString.length);
    //    queryString = 'tags:' + tagsQuery + '*';
    //  }
    //  else {
    //    if (queryString.length === 0) {
    //      queryString = 'title:';
    //    }
    //
    //    // make this a partial search if we're not in some reserved portion of the language,  comments on conditionals, in order:
    //    // 1. ends in reserved character, boosting, boolean operator ( -foo)
    //    // 2. typing a reserved word like AND, OR, NOT
    //    // 3. open parens (groupiing)
    //    // 4. open " (term phrase)
    //    // 5. open [ (range)
    //    // 6. open { (range)
    //    // see http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-query-string-query.html#query-string-syntax
    //    if (!queryString.match(/(\*|\]|}|~|\)|"|^\d+|\s[\-+]\w+)$/) &&
    //        !queryString.match(/[A-Z]$/) &&
    //        !endsInOpen(queryString, '(', ')') &&
    //        !endsInOpen(queryString, '"', '"') &&
    //        !endsInOpen(queryString, '[', ']') && !endsInOpen(queryString, '[', '}') &&
    //        !endsInOpen(queryString, '{', ']') && !endsInOpen(queryString, '{', '}')
    //    ){
    //      queryString += '*';
    //    }
    //  }
    //
    //  var query = {
    //    query: { query_string: { query: queryString } },
    //    facets: { tags: { terms: { field: "tags", order: "term", size: 50 } } },
    //    size: 10000,
    //    sort: ["_uid"],
    //  };
    //
    //  return this._post('/dashboard/_search', query)
    //    .then(function(results) {
    //      if(_.isUndefined(results.hits)) {
    //        return { dashboards: [], tags: [] };
    //      }
    //
    //      var resultsHits = results.hits.hits;
    //      var displayHits = { dashboards: [], tags: results.facets.tags.terms || [] };
    //
    //      for (var i = 0, len = resultsHits.length; i < len; i++) {
    //        var hit = resultsHits[i];
    //        displayHits.dashboards.push({
    //          id: hit._id,
    //          title: hit._source.title,
    //          tags: hit._source.tags
    //        });
    //      }
    //
    //      displayHits.tagsOnly = tagsOnly;
    //      return displayHits;
    //    });
    //};

/*
    .factory('res', function (client) {
      return client.res;
    })

      .factory('processingDataWorker', function ($q) {
        var defer = null,
          webWorker = new Worker('scripts/workers/processingDataWorker.js');

        webWorker.addEventListener('message', function(event){
          if (defer != null) {
            defer.resolve(event.data.result);
            defer = null;
          }
        });

        function executeWorkerTask(data){
          if (defer == null) {
            defer = $q.defer();
            webWorker.postMessage(data);
            return defer.promise;
          } else {
            return $q.reject('Processing data worker busy.');
          }
        }

        return {
          filterAndOrderMapNodes : function (nodeList, selectedMap) {
            return executeWorkerTask({method : 'filterAndOrderMapNodes',
              nodeList: nodeList,
              selectedMap : selectedMap});
          }
        };
      });
*/


    return NetCrunchDatasource;

  });

});
