define([
  'angular',
  'underscore',
  'moment'
], function (angular, _, moment) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('annotationsSrv', function(dashboard, datasourceSrv, $q, alertSrv, $rootScope) {
    var promiseCached;
    var annotationPanel;
    var list = [];

    this.init = function() {
      $rootScope.$on('refresh', this.clearCache);
      $rootScope.$on('dashboard-loaded', this.dashboardLoaded);

      this.dashboardLoaded();
    };

    this.dashboardLoaded = function () {
      annotationPanel = _.findWhere(dashboard.current.pulldowns, { type: 'annotations' });
    };

    this.clearCache = function() {
      promiseCached = null;
      list = [];
    };

    this.getAnnotations = function(filterSrv, rangeUnparsed) {
      if (!annotationPanel.enable) {
        return $q.when(null);
      }

      if (promiseCached) {
        return promiseCached;
      }

      var graphiteMetrics = this.getGraphiteMetrics(filterSrv, rangeUnparsed);
      var graphiteEvents = this.getGraphiteEvents(rangeUnparsed);

      promiseCached = $q.all(graphiteMetrics.concat(graphiteEvents))
        .then(function() {
          return list;
        });

      return promiseCached;
    };

    this.getGraphiteEvents = function(rangeUnparsed) {
      var annotations = this.getAnnotationsByType('graphite events');
      if (annotations.length === 0) {
        return [];
      }

      var promises = _.map(annotations, function(annotation) {

        return datasourceSrv.default.events({ range: rangeUnparsed, tags: annotation.tags })
          .then(function(results) {
            _.each(results.data, function (event) {
              addAnnotation({
                annotation: annotation,
                time: event.when * 1000,
                description: event.what,
                tags: event.tags,
                data: event.data
              });
            });
          })
          .then(null, errorHandler);
      });

      return promises;
    };

    this.getAnnotationsByType = function(type) {
      return _.where(annotationPanel.annotations, {
        type: type,
        enable: true
      });
    };

    this.getGraphiteMetrics = function(filterSrv, rangeUnparsed) {
      var annotations = this.getAnnotationsByType('graphite metric');
      if (annotations.length === 0) {
        return [];
      }

      var promises = _.map(annotations, function(annotation) {
        var graphiteQuery = {
          range: rangeUnparsed,
          targets: [{ target: annotation.target }],
          format: 'json',
          maxDataPoints: 100
        };

        var receiveFunc = _.partial(receiveGraphiteMetrics, annotation);

        return datasourceSrv.default.query(filterSrv, graphiteQuery)
          .then(receiveFunc)
          .then(null, errorHandler);
      });

      return promises;
    };

    function errorHandler(err) {
      console.log('Annotation error: ', err);
      alertSrv.set('Annotations','Could not fetch annotations','error');
    }

    function receiveGraphiteMetrics(annotation, results) {
      for (var i = 0; i < results.data.length; i++) {
        var target = results.data[i];

        for (var y = 0; y < target.datapoints.length; y++) {
          var datapoint = target.datapoints[y];

          if (datapoint[0]) {
            addAnnotation({
              annotation: annotation,
              time: datapoint[1] * 1000,
              description: target.target
            });
          }
        }
      }
    }

    function addAnnotation(options) {
      var tooltip = "<small><b>" + options.description + "</b><br/>";
      if (options.tags) {
        tooltip += (options.tags || '') + '<br/>';
      }
      tooltip += '<i>' + moment(options.time).format('YYYY-MM-DD HH:mm:ss') + '</i><br/>';
      if (options.data) {
        tooltip += options.data.replace(/\n/g, '<br/>');
      }
      tooltip += "</small>";

      list.push({
        annotation: options.annotation,
        min: options.time,
        max: options.time,
        eventType: options.annotation.name,
        title: null,
        description: tooltip,
        score: 1
      });
    }

    // Now init
    this.init();
  });

});
