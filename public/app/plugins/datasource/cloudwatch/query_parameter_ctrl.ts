import angular from 'angular';
import _ from 'lodash';

export class CloudWatchQueryParameter {
  constructor() {
    return {
      templateUrl: 'public/app/plugins/datasource/cloudwatch/partials/query.parameter.html',
      controller: 'CloudWatchQueryParameterCtrl',
      restrict: 'E',
      scope: {
        target: '=',
        datasource: '=',
        onChange: '&',
      },
    };
  }
}

export class CloudWatchQueryParameterCtrl {
  /** @ngInject */
  constructor($scope, templateSrv, uiSegmentSrv, datasourceSrv, $q) {
    $scope.init = function() {
      var target = $scope.target;
      target.namespace = target.namespace || '';
      target.metricName = target.metricName || '';
      target.statistics = target.statistics || ['Average'];
      target.dimensions = target.dimensions || {};
      target.period = target.period || '';
      target.region = target.region || 'default';
      target.id = target.id || '';
      target.expression = target.expression || '';
      target.returnData = target.returnData || false;
      target.highResolution = target.highResolution || false;

      $scope.regionSegment = uiSegmentSrv.getSegmentForValue($scope.target.region, 'select region');
      $scope.namespaceSegment = uiSegmentSrv.getSegmentForValue($scope.target.namespace, 'select namespace');
      $scope.metricSegment = uiSegmentSrv.getSegmentForValue($scope.target.metricName, 'select metric');

      $scope.dimSegments = _.reduce(
        $scope.target.dimensions,
        function(memo, value, key) {
          memo.push(uiSegmentSrv.newKey(key));
          memo.push(uiSegmentSrv.newOperator('='));
          memo.push(uiSegmentSrv.newKeyValue(value));
          return memo;
        },
        []
      );

      $scope.statSegments = _.map($scope.target.statistics, function(stat) {
        return uiSegmentSrv.getSegmentForValue(stat);
      });

      $scope.ensurePlusButton($scope.statSegments);
      $scope.ensurePlusButton($scope.dimSegments);
      $scope.removeDimSegment = uiSegmentSrv.newSegment({
        fake: true,
        value: '-- remove dimension --',
      });
      $scope.removeStatSegment = uiSegmentSrv.newSegment({
        fake: true,
        value: '-- remove stat --',
      });

      if (_.isEmpty($scope.target.region)) {
        $scope.target.region = 'default';
      }

      if (!$scope.onChange) {
        $scope.onChange = function() {};
      }
    };

    $scope.getStatSegments = function() {
      return $q.when(
        _.flatten([
          angular.copy($scope.removeStatSegment),
          _.map($scope.datasource.standardStatistics, function(s) {
            return uiSegmentSrv.getSegmentForValue(s);
          }),
          uiSegmentSrv.getSegmentForValue('pNN.NN'),
        ])
      );
    };

    $scope.statSegmentChanged = function(segment, index) {
      if (segment.value === $scope.removeStatSegment.value) {
        $scope.statSegments.splice(index, 1);
      } else {
        segment.type = 'value';
      }

      $scope.target.statistics = _.reduce(
        $scope.statSegments,
        function(memo, seg) {
          if (!seg.fake) {
            memo.push(seg.value);
          }
          return memo;
        },
        []
      );

      $scope.ensurePlusButton($scope.statSegments);
      $scope.onChange();
    };

    $scope.ensurePlusButton = function(segments) {
      var count = segments.length;
      var lastSegment = segments[Math.max(count - 1, 0)];

      if (!lastSegment || lastSegment.type !== 'plus-button') {
        segments.push(uiSegmentSrv.newPlusButton());
      }
    };

    $scope.getDimSegments = function(segment, $index) {
      if (segment.type === 'operator') {
        return $q.when([]);
      }

      var target = $scope.target;
      var query = $q.when([]);

      if (segment.type === 'key' || segment.type === 'plus-button') {
        query = $scope.datasource.getDimensionKeys($scope.target.namespace, $scope.target.region);
      } else if (segment.type === 'value') {
        var dimensionKey = $scope.dimSegments[$index - 2].value;
        query = $scope.datasource.getDimensionValues(
          target.region,
          target.namespace,
          target.metricName,
          dimensionKey,
          target.dimensions
        );
      }

      return query.then($scope.transformToSegments(true)).then(function(results) {
        if (segment.type === 'key') {
          results.splice(0, 0, angular.copy($scope.removeDimSegment));
        }
        return results;
      });
    };

    $scope.dimSegmentChanged = function(segment, index) {
      $scope.dimSegments[index] = segment;

      if (segment.value === $scope.removeDimSegment.value) {
        $scope.dimSegments.splice(index, 3);
      } else if (segment.type === 'plus-button') {
        $scope.dimSegments.push(uiSegmentSrv.newOperator('='));
        $scope.dimSegments.push(uiSegmentSrv.newFake('select dimension value', 'value', 'query-segment-value'));
        segment.type = 'key';
        segment.cssClass = 'query-segment-key';
      }

      $scope.syncDimSegmentsWithModel();
      $scope.ensurePlusButton($scope.dimSegments);
      $scope.onChange();
    };

    $scope.syncDimSegmentsWithModel = function() {
      var dims = {};
      var length = $scope.dimSegments.length;

      for (var i = 0; i < length - 2; i += 3) {
        var keySegment = $scope.dimSegments[i];
        var valueSegment = $scope.dimSegments[i + 2];
        if (!valueSegment.fake) {
          dims[keySegment.value] = valueSegment.value;
        }
      }

      $scope.target.dimensions = dims;
    };

    $scope.getRegions = function() {
      return $scope.datasource
        .metricFindQuery('regions()')
        .then(function(results) {
          results.unshift({ text: 'default' });
          return results;
        })
        .then($scope.transformToSegments(true));
    };

    $scope.getNamespaces = function() {
      return $scope.datasource.metricFindQuery('namespaces()').then($scope.transformToSegments(true));
    };

    $scope.getMetrics = function() {
      return $scope.datasource
        .metricFindQuery('metrics(' + $scope.target.namespace + ',' + $scope.target.region + ')')
        .then($scope.transformToSegments(true));
    };

    $scope.regionChanged = function() {
      $scope.target.region = $scope.regionSegment.value;
      $scope.onChange();
    };

    $scope.namespaceChanged = function() {
      $scope.target.namespace = $scope.namespaceSegment.value;
      $scope.onChange();
    };

    $scope.metricChanged = function() {
      $scope.target.metricName = $scope.metricSegment.value;
      $scope.onChange();
    };

    $scope.transformToSegments = function(addTemplateVars) {
      return function(results) {
        var segments = _.map(results, function(segment) {
          return uiSegmentSrv.newSegment({
            value: segment.text,
            expandable: segment.expandable,
          });
        });

        if (addTemplateVars) {
          _.each(templateSrv.variables, function(variable) {
            segments.unshift(
              uiSegmentSrv.newSegment({
                type: 'template',
                value: '$' + variable.name,
                expandable: true,
              })
            );
          });
        }

        return segments;
      };
    };

    $scope.init();
  }
}

angular.module('grafana.controllers').directive('cloudwatchQueryParameter', CloudWatchQueryParameter);
angular.module('grafana.controllers').controller('CloudWatchQueryParameterCtrl', CloudWatchQueryParameterCtrl);
