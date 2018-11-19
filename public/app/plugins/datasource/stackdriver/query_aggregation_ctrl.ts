import coreModule from 'app/core/core_module';
import _ from 'lodash';
import * as options from './constants';
import { getAlignmentOptionsByMetric, getAggregationOptionsByMetric } from './functions';
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
  alignmentPeriods: any[];
  aggOptions: any[];
  alignOptions: any[];
  target: any;

  /** @ngInject */
  constructor(private $scope, private templateSrv) {
    this.$scope.ctrl = this;
    this.target = $scope.target;
    this.alignmentPeriods = options.alignmentPeriods;
    this.aggOptions = options.aggOptions;
    this.alignOptions = options.alignOptions;
    this.setAggOptions();
    this.setAlignOptions();
    const self = this;
    $scope.$on('metricTypeChanged', () => {
      self.setAggOptions();
      self.setAlignOptions();
    });
  }

  setAlignOptions() {
    this.alignOptions = getAlignmentOptionsByMetric(this.target.valueType, this.target.metricKind);
    if (!this.alignOptions.find(o => o.value === this.templateSrv.replace(this.target.aggregation.perSeriesAligner))) {
      this.target.aggregation.perSeriesAligner = this.alignOptions.length > 0 ? this.alignOptions[0].value : '';
    }
  }

  setAggOptions() {
    this.aggOptions = getAggregationOptionsByMetric(this.target.valueType, this.target.metricKind);

    if (!this.aggOptions.find(o => o.value === this.templateSrv.replace(this.target.aggregation.crossSeriesReducer))) {
      this.deselectAggregationOption('REDUCE_NONE');
    }

    if (this.target.aggregation.groupBys.length > 0) {
      this.aggOptions = this.aggOptions.filter(o => o.value !== 'REDUCE_NONE');
      this.deselectAggregationOption('REDUCE_NONE');
    }
  }

  formatAlignmentText() {
    const selectedAlignment = this.alignOptions.find(
      ap => ap.value === this.templateSrv.replace(this.target.aggregation.perSeriesAligner)
    );
    return `${kbn.secondsToHms(this.$scope.alignmentPeriod)} interval (${
      selectedAlignment ? selectedAlignment.text : ''
    })`;
  }

  deselectAggregationOption(notValidOptionValue: string) {
    const newValue = this.aggOptions.find(o => o.value !== notValidOptionValue);
    this.target.aggregation.crossSeriesReducer = newValue ? newValue.value : '';
  }
}

coreModule.directive('stackdriverAggregation', StackdriverAggregation);
coreModule.controller('StackdriverAggregationCtrl', StackdriverAggregationCtrl);
