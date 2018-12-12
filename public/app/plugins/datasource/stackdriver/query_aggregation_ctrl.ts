import coreModule from 'app/core/core_module';
import _ from 'lodash';
import { alignmentPeriods } from './constants';
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
    this.alignmentPeriods = [
      this.getTemplateVariablesGroup(),
      {
        label: 'Alignment Periods',
        options: alignmentPeriods.map(ap => ({
          ...ap,
          label: ap.text,
        })),
      },
    ];
    this.setAggOptions();
    this.setAlignOptions();
    const self = this;
    $scope.$on('metricTypeChanged', () => {
      self.setAggOptions();
      self.setAlignOptions();
    });
    this.handleAlignmentChange = this.handleAlignmentChange.bind(this);
    this.handleAggregationChange = this.handleAggregationChange.bind(this);
    this.handleAlignmentPeriodChange = this.handleAlignmentPeriodChange.bind(this);
  }

  setAlignOptions() {
    console.log('this.target.metricKind', this.target.metricKind);
    const alignments = getAlignmentOptionsByMetric(this.target.valueType, this.target.metricKind).map(a => ({
      ...a,
      label: a.text,
    }));
    this.alignOptions = [
      this.getTemplateVariablesGroup(),
      {
        label: 'Alignment Options',
        options: alignments,
      },
    ];
    if (!alignments.find(o => o.value === this.templateSrv.replace(this.target.aggregation.perSeriesAligner))) {
      this.target.aggregation.perSeriesAligner = alignments.length > 0 ? alignments[0].value : '';
    }
  }

  setAggOptions() {
    let aggregations = getAggregationOptionsByMetric(this.target.valueType, this.target.metricKind).map(a => ({
      ...a,
      label: a.text,
    }));
    if (!aggregations.find(o => o.value === this.templateSrv.replace(this.target.aggregation.crossSeriesReducer))) {
      this.deselectAggregationOption('REDUCE_NONE');
    }

    if (this.target.aggregation.groupBys.length > 0) {
      aggregations = aggregations.filter(o => o.value !== 'REDUCE_NONE');
      this.deselectAggregationOption('REDUCE_NONE');
    }
    this.aggOptions = [
      this.getTemplateVariablesGroup(),
      {
        label: 'Aggregations',
        options: aggregations,
      },
    ];
  }

  handleAlignmentChange(value) {
    this.target.aggregation.perSeriesAligner = value;
    this.$scope.refresh();
  }

  handleAggregationChange(value) {
    this.target.aggregation.crossSeriesReducer = value;
    this.$scope.refresh();
  }

  handleAlignmentPeriodChange(value) {
    this.target.aggregation.alignmentPeriod = value;
    this.$scope.refresh();
  }

  formatAlignmentText() {
    const alignments = getAlignmentOptionsByMetric(this.target.valueType, this.target.metricKind);
    const selectedAlignment = alignments.find(
      ap => ap.value === this.templateSrv.replace(this.target.aggregation.perSeriesAligner)
    );
    return `${kbn.secondsToHms(this.$scope.alignmentPeriod)} interval (${
      selectedAlignment ? selectedAlignment.text : ''
    })`;
  }

  deselectAggregationOption(notValidOptionValue: string) {
    const aggregations = getAggregationOptionsByMetric(this.target.valueType, this.target.metricKind);
    const newValue = aggregations.find(o => o.value !== notValidOptionValue);
    this.target.aggregation.crossSeriesReducer = newValue ? newValue.value : '';
  }

  getTemplateVariablesGroup() {
    return {
      label: 'Template Variables',
      options: this.templateSrv.variables.map(v => ({
        label: `$${v.name}`,
        value: `$${v.name}`,
      })),
    };
  }
}

coreModule.directive('stackdriverAggregation', StackdriverAggregation);
coreModule.controller('StackdriverAggregationCtrl', StackdriverAggregationCtrl);
