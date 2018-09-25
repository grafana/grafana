import angular from 'angular';
import _ from 'lodash';
import * as options from './constants';

export class StackdriverAggregation {
  constructor() {
    return {
      templateUrl: 'public/app/plugins/datasource/stackdriver/partials/query.aggregation.html',
      controller: 'StackdriverAggregationCtrl',
      restrict: 'E',
      scope: {
        target: '=',
        refresh: '&',
      },
    };
  }
}

export class StackdriverAggregationCtrl {
  target: any;
  alignOptions: any[];
  aggOptions: any[];
  refresh: () => void;

  constructor($scope) {
    this.aggOptions = options.aggOptions;
    this.alignOptions = options.alignOptions;
    $scope.alignmentPeriods = options.alignmentPeriods;
    $scope.getAlignOptions = this.getAlignOptions;
    $scope.getAggOptions = this.getAggOptions;
    $scope.onAlignmentChange = this.onAlignmentChange;
    $scope.onAggregationChange = this.onAggregationChange;
    this.refresh = $scope.refresh;
  }

  onAlignmentChange(newVal: string) {
    if (newVal === 'ALIGN_NONE') {
      this.target.aggregation.crossSeriesReducer = 'REDUCE_NONE';
    }
    this.refresh();
  }

  onAggregationChange(newVal: string) {
    if (newVal !== 'REDUCE_NONE') {
      const newAlignmentOption = options.alignOptions.find(o => o.value !== 'ALIGN_NONE');
      this.target.aggregation.perSeriesAligner = newAlignmentOption ? newAlignmentOption.value : '';
    }
    this.refresh();
  }

  getAlignOptions() {
    return !this.target.valueType
      ? options.alignOptions
      : options.alignOptions.filter(i => {
          return (
            i.valueTypes.indexOf(this.target.valueType) !== -1 && i.metricKinds.indexOf(this.target.metricKind) !== -1
          );
        });
  }

  getAggOptions() {
    return !this.target.metricKind
      ? options.aggOptions
      : options.aggOptions.filter(i => {
          return (
            i.valueTypes.indexOf(this.target.valueType) !== -1 && i.metricKinds.indexOf(this.target.metricKind) !== -1
          );
        });
  }
}

angular.module('grafana.controllers').directive('stackdriverAggregation', StackdriverAggregation);
angular.module('grafana.controllers').controller('StackdriverAggregationCtrl', StackdriverAggregationCtrl);
