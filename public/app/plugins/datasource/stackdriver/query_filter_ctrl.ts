import coreModule from 'app/core/core_module';
import _ from 'lodash';
import { FilterSegments } from './filter_segments';
import { QueryMeta } from './types';
// import appEvents from 'app/core/app_events';

export class StackdriverFilter {
  /** @ngInject */
  constructor() {
    return {
      templateUrl: 'public/app/plugins/datasource/stackdriver/partials/query.filter.html',
      controller: 'StackdriverFilterCtrl',
      controllerAs: 'ctrl',
      restrict: 'E',
      scope: {
        labelData: '<',
        loading: '<',
        target: '=',
        refresh: '&',
        hideGroupBys: '<',
      },
    };
  }
}

export class StackdriverFilterCtrl {
  metricLabels: { [key: string]: string[] };
  resourceLabels: { [key: string]: string[] };
  resourceTypes: string[];

  defaultRemoveGroupByValue = '-- remove group by --';
  resourceTypeValue = 'resource.type';

  metricDescriptors: any[];
  metrics: any[];
  services: any[];
  groupBySegments: any[];
  filterSegments: FilterSegments;
  removeSegment: any;
  target: any;

  labelData: QueryMeta;
  loading: Promise<any>;

  /** @ngInject */
  constructor(private $scope, private uiSegmentSrv, private templateSrv, private $rootScope) {
    this.target = $scope.target;
    this.metricDescriptors = [];
    this.metrics = [];
    this.services = [];

    this.initSegments($scope.hideGroupBys);
  }

  initSegments(hideGroupBys: boolean) {
    if (!hideGroupBys) {
      this.groupBySegments = this.target.aggregation.groupBys.map(groupBy => {
        return this.uiSegmentSrv.getSegmentForValue(groupBy);
      });
      this.ensurePlusButton(this.groupBySegments);
    }

    this.removeSegment = this.uiSegmentSrv.newSegment({ fake: true, value: '-- remove group by --' });

    // this.filterSegments = new FilterSegments(
    //   this.uiSegmentSrv,
    //   this.target,
    //   this.getFilterKeys.bind(this),
    //   this.getFilterValues.bind(this)
    // );
    // this.filterSegments.buildSegmentModel();
  }

  // async getLabels() {
  //   this.loadLabelsPromise = new Promise(async resolve => {
  //     try {
  //       if (this.target.metricType) {
  //         const { meta } = await this.datasource.getLabels(this.target.metricType, this.target.refId);
  //         this.$scope.labelData.metricLabels = meta.metricLabels;
  //         this.$scope.labelData.resourceLabels = meta.resourceLabels;
  //         this.$scope.labelData.resourceTypes = meta.resourceTypes;
  //         resolve();
  //       } else {
  //         resolve();
  //       }
  //     } catch (error) {
  //       if (error.data && error.data.message) {
  //         console.log(error.data.message);
  //       } else {
  //         console.log(error);
  //       }
  //       appEvents.emit('alert-error', ['Error', 'Error loading metric labels for ' + this.target.metricType]);
  //       resolve();
  //     }
  //   });
  // }

  async createLabelKeyElements() {
    await this.$scope.loading;

    let elements = Object.keys(this.$scope.labelData.metricLabels || {}).map(l => {
      return this.uiSegmentSrv.newSegment({
        value: `metric.label.${l}`,
        expandable: false,
      });
    });

    elements = [
      ...elements,
      ...Object.keys(this.$scope.labelData.resourceLabels || {}).map(l => {
        return this.uiSegmentSrv.newSegment({
          value: `resource.label.${l}`,
          expandable: false,
        });
      }),
    ];

    if (this.$scope.labelData.resourceTypes && this.$scope.labelData.resourceTypes.length > 0) {
      elements = [
        ...elements,
        this.uiSegmentSrv.newSegment({
          value: this.resourceTypeValue,
          expandable: false,
        }),
      ];
    }

    return elements;
  }

  async getFilterKeys(segment, removeText?: string) {
    let elements = await this.createLabelKeyElements();

    if (this.target.filters.indexOf(this.resourceTypeValue) !== -1) {
      elements = elements.filter(e => e.value !== this.resourceTypeValue);
    }

    const noValueOrPlusButton = !segment || segment.type === 'plus-button';
    if (noValueOrPlusButton && elements.length === 0) {
      return [];
    }

    return [
      ...elements,
      this.uiSegmentSrv.newSegment({ fake: true, value: removeText || this.defaultRemoveGroupByValue }),
    ];
  }

  async getGroupBys(segment) {
    let elements = await this.createLabelKeyElements();

    elements = elements.filter(e => this.target.aggregation.groupBys.indexOf(e.value) === -1);
    const noValueOrPlusButton = !segment || segment.type === 'plus-button';
    if (noValueOrPlusButton && elements.length === 0) {
      return [];
    }

    this.removeSegment.value = this.defaultRemoveGroupByValue;
    return [...elements, this.removeSegment];
  }

  groupByChanged(segment, index) {
    if (segment.value === this.removeSegment.value) {
      this.groupBySegments.splice(index, 1);
    } else {
      segment.type = 'value';
    }

    const reducer = (memo, seg) => {
      if (!seg.fake) {
        memo.push(seg.value);
      }
      return memo;
    };

    this.target.aggregation.groupBys = this.groupBySegments.reduce(reducer, []);
    this.ensurePlusButton(this.groupBySegments);
    this.$rootScope.$broadcast('metricTypeChanged');
    this.$scope.refresh();
  }

  async getFilters(segment, index) {
    const hasNoFilterKeys =
      this.$scope.labelData.metricLabels && Object.keys(this.$scope.labelData.metricLabels).length === 0;
    return this.filterSegments.getFilters(segment, index, hasNoFilterKeys);
  }

  getFilterValues(index) {
    const filterKey = this.templateSrv.replace(this.filterSegments.filterSegments[index - 2].value);
    if (
      !filterKey ||
      !this.$scope.labelData.metricLabels ||
      Object.keys(this.$scope.labelData.metricLabels).length === 0
    ) {
      return [];
    }

    const shortKey = filterKey.substring(filterKey.indexOf('.label.') + 7);

    if (filterKey.startsWith('metric.label.') && this.$scope.labelData.metricLabels.hasOwnProperty(shortKey)) {
      return this.$scope.labelData.metricLabels[shortKey];
    }

    if (filterKey.startsWith('resource.label.') && this.$scope.labelData.resourceLabels.hasOwnProperty(shortKey)) {
      return this.$scope.labelData.resourceLabels[shortKey];
    }

    if (filterKey === this.resourceTypeValue) {
      return this.$scope.labelData.resourceTypes;
    }

    return [];
  }

  filterSegmentUpdated(segment, index) {
    this.target.filters = this.filterSegments.filterSegmentUpdated(segment, index);
    this.$scope.refresh();
  }

  ensurePlusButton(segments) {
    const count = segments.length;
    const lastSegment = segments[Math.max(count - 1, 0)];

    if (!lastSegment || lastSegment.type !== 'plus-button') {
      segments.push(this.uiSegmentSrv.newPlusButton());
    }
  }
}

coreModule.directive('stackdriverFilter', StackdriverFilter);
coreModule.controller('StackdriverFilterCtrl', StackdriverFilterCtrl);
