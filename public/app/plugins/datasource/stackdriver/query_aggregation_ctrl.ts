import angular from 'angular';
import _ from 'lodash';
import * as options from './constants';
import kbn from 'app/core/utils/kbn';

export class StackdriverAggregation {
  constructor() {
    return {
      templateUrl: 'public/app/plugins/datasource/stackdriver/partials/query.aggregation.html',
      controller: 'StackdriverAggregationCtrl',
      restrict: 'E',
      scope: {
        target: '=',
        alignmentPeriod: '<',
        refresh: '&',
      },
    };
  }
}

export class StackdriverAggregationCtrl {
  constructor(private $scope) {
    $scope.aggOptions = options.aggOptions;
    this.setAggOptions();
    this.setAlignOptions();
    $scope.alignmentPeriods = options.alignmentPeriods;
    $scope.formatAlignmentText = this.formatAlignmentText.bind(this);
    $scope.$on('metricTypeChanged', this.setAlignOptions.bind(this));
  }

  setAlignOptions() {
    this.$scope.alignOptions = !this.$scope.target.valueType
      ? []
      : options.alignOptions.filter(i => {
          return (
            i.valueTypes.indexOf(this.$scope.target.valueType) !== -1 &&
            i.metricKinds.indexOf(this.$scope.target.metricKind) !== -1
          );
        });
    if (!this.$scope.alignOptions.find(o => o.value === this.$scope.target.aggregation.perSeriesAligner)) {
      this.$scope.target.aggregation.perSeriesAligner =
        this.$scope.alignOptions.length > 0 ? this.$scope.alignOptions[0].value : '';
    }
  }

  setAggOptions() {
    this.$scope.aggOptions = !this.$scope.target.metricKind
      ? []
      : options.aggOptions.filter(i => {
          return (
            i.valueTypes.indexOf(this.$scope.target.valueType) !== -1 &&
            i.metricKinds.indexOf(this.$scope.target.metricKind) !== -1
          );
        });

    if (!this.$scope.aggOptions.find(o => o.value === this.$scope.target.aggregation.crossSeriesReducer)) {
      const newValue = this.$scope.aggOptions.find(o => o.value !== 'REDUCE_NONE');
      this.$scope.target.aggregation.crossSeriesReducer = newValue ? newValue.value : '';
    }
  }

  formatAlignmentText() {
    const selectedAlignment = this.$scope.alignOptions.find(
      ap => ap.value === this.$scope.target.aggregation.perSeriesAligner
    );
    return `${kbn.secondsToHms(this.$scope.alignmentPeriod)} interval (${selectedAlignment.text})`;
  }
}

angular.module('grafana.controllers').directive('stackdriverAggregation', StackdriverAggregation);
angular.module('grafana.controllers').controller('StackdriverAggregationCtrl', StackdriverAggregationCtrl);
