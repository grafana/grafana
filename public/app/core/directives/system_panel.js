define([
    'jquery',
    'lodash',
    '../core_module',
    'app/core/utils/datemath',
    'jquery.flot',
    'jquery.flot.pie',
  ],
  function ($, _, coreModule, dateMath) {
    'use strict';

    coreModule.directive('systemPanel', function ($parse, alertMgrSrv, healthSrv, datasourceSrv, contextSrv, backendSrv) {
      return {
        restrict: 'E',
        link: function (scope, elem, attr) {
          var getter = $parse(attr.sys), system = getter(scope);
          datasourceSrv.get("opentsdb").then(function (datasource) {
            scope.datasource = datasource;
          }).then(function () {
            contextSrv.system = system;

            //------get service satatus
            var serviesMap = _.allServies();
            scope.servies = [];
            _.each(Object.keys(serviesMap), function (key) {
              var queries = [{
                "metric": contextSrv.user.orgId + "." + system + "." + key + ".state",
                "aggregator": "sum",
                "downsample": "10m-sum",
              }];

              scope.datasource.performTimeSeriesQuery(queries, dateMath.parse('now-10m', false).valueOf(), null).then(function (response) {
                if (_.isEmpty(response.data)) {
                  throw Error;
                }
                var service = {
                  "name": serviesMap[key],
                  "status": response.data[0].dps[Object.keys(response.data[0].dps)[0]]
                };
                scope.servies.push(service);
              }).catch(function () {

              });
            });


            //------- get Alerts status
            alertMgrSrv.loadTriggeredAlerts().then(function onSuccess(response) {
              scope.critical = 0;
              scope.warn = 0;
              var pieData = [];
              if(response.data.length) {
                for (var i = 0; i < response.data.length; i++) {
                  var alertDetail = response.data[i];
                  if (alertDetail.status.level === "CRITICAL") {
                    scope.critical ++;
                  } else {
                    scope.warn ++;
                  }
                }
                pieData = [
                  {label: "警告", data:scope.warn},
                  {label: "严重", data:scope.critical},
                ];
                $.plot("#alert-pie", pieData, {
                  series: {
                    pie: {
                      show: true
                    }
                  }
                });
              } else {
                scope.alertTrigger = true;
              }
            });

            //------- get health/anomaly status
            healthSrv.load().then(function (data) {
              scope.numMetrics = data.numMetrics;
              scope.numAnomalyMetrics = data.numAnomalyMetrics;
              scope.health = data.health;
            });

            //-------- get host status
            scope.hostList = [];
            backendSrv.alertD({
              method: "get",
              url: "/summary",
              params: {metrics: "collector.summary"},
              headers: {'Content-Type': 'text/plain'},
            }).then(function (response) {
              _.each(response.data, function (summary) {
                var host = {
                  "host": summary.tag.host,
                  "status": 0,
                };

                var queries = [{
                  "metric": contextSrv.user.orgId + "." + system + ".collector.state",
                  "aggregator": "sum",
                  "downsample": "1m-sum",
                  "tags": {"host": summary.tag.host}
                }];

                scope.datasource.performTimeSeriesQuery(queries, dateMath.parse('now-1m', false).valueOf(), null).then(function (response) {
                  if (_.isEmpty(response.data)) {
                    throw Error;
                  }
                  _.each(response.data, function (metricData) {
                    if (_.isObject(metricData)) {
                      if (metricData.dps[Object.keys(metricData.dps)[0]] > 0) {
                        host.status = "1"
                      } else {
                        host.status = "0";
                      }
                    }
                  });
                }).catch(function () {
                  //nothing to do ;
                });

                scope.hostList.push(host);
              });
            });
          });
        }
      };
    });
  });