define([
  'angular',
  'lodash',
  'app/core/config'
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('MetricKeysCtrl', function($scope, $http, $q) {
    var elasticSearchUrlForMetricIndex = config.elasticsearch + '/' + config.grafana_metrics_index + '/';
    var httpOptions = {};
    if (config.elasticsearchBasicAuth) {
      httpOptions.withCredentials = true;
      httpOptions.headers = {
        "Authorization": "Basic " + config.elasticsearchBasicAuth
      };
    }
    $scope.init = function () {
      $scope.metricPath = "prod.apps.api.boobarella.*";
      $scope.metricCounter = 0;
    };

    $scope.createIndex = function () {
      $scope.errorText = null;
      $scope.infoText = null;

      deleteIndex()
        .then(createIndex)
        .then(function () {
          $scope.infoText = "Index created!";
        })
        .then(null, function (err) {
          $scope.errorText = angular.toJson(err);
        });
    };

    $scope.loadMetricsFromPath = function() {
      $scope.errorText = null;
      $scope.infoText = null;
      $scope.metricCounter = 0;

      return loadMetricsRecursive($scope.metricPath)
        .then(function() {
          $scope.infoText = "Indexing completed!";
        }, function(err) {
          $scope.errorText = "Error: " + err;
        });
    };

    $scope.loadAll = function() {
      $scope.infoText = "Fetching all metrics from graphite...";

      getFromEachGraphite('/metrics/index.json', saveMetricsArray)
        .then(function() {
          $scope.infoText = "Indexing complete!";
        }).then(null, function(err) {
          $scope.errorText = err;
        });
    };

    function getFromEachGraphite(request, data_callback, error_callback) {
      return $q.all(_.map(config.datasources, function(datasource) {
        if (datasource.type = 'graphite') {
          return $http.get(datasource.url + request)
            .then(data_callback, error_callback);
        }
      }));
    }

    function saveMetricsArray(data, currentIndex) {
      if (!data && !data.data && data.data.length === 0) {
        return $q.reject('No metrics from graphite');
      }

      if (data.data.length === currentIndex) {
        return $q.when('done');
      }

      currentIndex = currentIndex || 0;

      return saveMetricKey(data.data[currentIndex])
        .then(function() {
          return saveMetricsArray(data, currentIndex + 1);
        });
    }

    function deleteIndex()
    {
      var deferred = $q.defer();
      $http.delete(elasticSearchUrlForMetricIndex, httpOptions)
        .success(function() {
          deferred.resolve('ok');
        })
        .error(function(data, status) {
          if (status === 404) {
            deferred.resolve('ok');
          }
          else {
            deferred.reject('elastic search returned unexpected error');
          }
        });

      return deferred.promise;
    }

    function createIndex()
    {
      return $http.put(elasticSearchUrlForMetricIndex, {
        settings: {
          analysis: {
            analyzer: {
              metric_path_ngram : { tokenizer : "my_ngram_tokenizer" }
            },
            tokenizer: {
              my_ngram_tokenizer : {
                type : "nGram",
                min_gram : "3",
                max_gram : "8",
                token_chars: ["letter", "digit", "punctuation", "symbol"]
              }
            }
          }
        },
        mappings: {
          metricKey: {
            properties: {
              metricPath: {
                type: "multi_field",
                fields: {
                  "metricPath": { type: "string", index: "analyzed", index_analyzer: "standard" },
                  "metricPath_ng": { type: "string", index: "analyzed", index_analyzer: "metric_path_ngram" }
                }
              }
            }
          }
        }
      }, httpOptions);
    }

    function receiveMetric(result) {
      var data = result.data;
      if (!data || data.length === 0) {
        console.log('no data');
        return;
      }

      var funcs = _.map(data, function(metric) {
        if (metric.expandable) {
          return loadMetricsRecursive(metric.id + ".*");
        }
        if (metric.leaf) {
          return saveMetricKey(metric.id);
        }
      });

      return $q.all(funcs);
    }

    function saveMetricKey(metricId) {

      // Create request with id as title. Rethink this.
      var request = $scope.ejs.Document(config.grafana_metrics_index, 'metricKey', metricId).source({
        metricPath: metricId
      });

      return request.doIndex(
        function() {
          $scope.infoText = "Indexing " + metricId;
          $scope.metricCounter = $scope.metricCounter + 1;
        },
        function() {
          $scope.errorText = "failed to save metric " + metricId;
        }
      );
    }

    function loadMetricsRecursive(metricPath)
    {
      return getFromEachGraphite('/metrics/find/?query=' + metricPath, receiveMetric);
    }

  });

});
