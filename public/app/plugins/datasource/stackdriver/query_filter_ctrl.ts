import coreModule from 'app/core/core_module';
import _ from 'lodash';
import { FilterSegments, DefaultFilterValue } from './filter_segments';

export class StackdriverFilterCtrl {
  defaultRemoveGroupByValue = '-- remove group by --';
  resourceTypeValue = 'resource.type';
  groupBySegments: any[];
  filterSegments: FilterSegments;
  removeSegment: any;
  filters: string[];
  groupBys: string[];
  hideGroupBys: boolean;
  labelData: any;
  loading: Promise<any>;
  filtersChanged: (filters) => void;
  groupBysChanged: (groupBys) => void;

  /** @ngInject */
  constructor(private $scope, private uiSegmentSrv, private templateSrv) {
    this.$scope.ctrl = this;
    this.initSegments(this.hideGroupBys);
  }

  initSegments(hideGroupBys: boolean) {
    if (!hideGroupBys) {
      this.groupBySegments = this.groupBys.map(groupBy => {
        return this.uiSegmentSrv.getSegmentForValue(groupBy);
      });
      this.ensurePlusButton(this.groupBySegments);
    }

    this.removeSegment = this.uiSegmentSrv.newSegment({ fake: true, value: '-- remove group by --' });

    this.filterSegments = new FilterSegments(
      this.uiSegmentSrv,
      this.filters,
      this.getFilterKeys.bind(this),
      this.getFilterValues.bind(this)
    );
    this.filterSegments.buildSegmentModel();
  }

  async createLabelKeyElements() {
    await this.loading;

    let elements = Object.keys(this.labelData.metricLabels || {}).map(l => {
      return this.uiSegmentSrv.newSegment({
        value: `metric.label.${l}`,
        expandable: false,
      });
    });

    elements = [
      ...elements,
      ...Object.keys(this.labelData.resourceLabels || {}).map(l => {
        return this.uiSegmentSrv.newSegment({
          value: `resource.label.${l}`,
          expandable: false,
        });
      }),
    ];

    if (this.labelData.resourceTypes && this.labelData.resourceTypes.length > 0) {
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

  async getFilterKeys(segment, removeText: string) {
    let elements = await this.createLabelKeyElements();

    if (this.filters.indexOf(this.resourceTypeValue) !== -1) {
      elements = elements.filter(e => e.value !== this.resourceTypeValue);
    }

    const noValueOrPlusButton = !segment || segment.type === 'plus-button';
    if (noValueOrPlusButton && elements.length === 0) {
      return [];
    }

    return segment.type === 'plus-button'
      ? elements
      : [
          ...elements,
          this.uiSegmentSrv.newSegment({ fake: true, value: removeText || this.defaultRemoveGroupByValue }),
        ];
  }

  async getGroupBys(segment) {
    let elements = await this.createLabelKeyElements();
    elements = elements.filter(e => this.groupBys.indexOf(e.value) === -1);
    const noValueOrPlusButton = !segment || segment.type === 'plus-button';
    if (noValueOrPlusButton && elements.length === 0) {
      return [];
    }

    this.removeSegment.value = this.defaultRemoveGroupByValue;
    return segment.type === 'plus-button' ? elements : [...elements, this.removeSegment];
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

    const groupBys = this.groupBySegments.reduce(reducer, []);
    this.groupBysChanged({ groupBys });
    this.ensurePlusButton(this.groupBySegments);
  }

  async getFilters(segment, index) {
    await this.loading;
    const hasNoFilterKeys = this.labelData.metricLabels && Object.keys(this.labelData.metricLabels).length === 0;
    return this.filterSegments.getFilters(segment, index, hasNoFilterKeys);
  }

  getFilterValues(index) {
    const filterKey = this.templateSrv.replace(this.filterSegments.filterSegments[index - 2].value);
    if (!filterKey || !this.labelData.metricLabels || Object.keys(this.labelData.metricLabels).length === 0) {
      return [];
    }

    const shortKey = filterKey.substring(filterKey.indexOf('.label.') + 7);

    if (filterKey.startsWith('metric.label.') && this.labelData.metricLabels.hasOwnProperty(shortKey)) {
      return this.labelData.metricLabels[shortKey];
    }

    if (filterKey.startsWith('resource.label.') && this.labelData.resourceLabels.hasOwnProperty(shortKey)) {
      return this.labelData.resourceLabels[shortKey];
    }

    if (filterKey === this.resourceTypeValue) {
      return this.labelData.resourceTypes;
    }

    return [];
  }

  filterSegmentUpdated(segment, index) {
    const filters = this.filterSegments.filterSegmentUpdated(segment, index);
    if (!filters.some(f => f === DefaultFilterValue)) {
      this.filtersChanged({ filters });
    }
  }

  ensurePlusButton(segments) {
    const count = segments.length;
    const lastSegment = segments[Math.max(count - 1, 0)];

    if (!lastSegment || lastSegment.type !== 'plus-button') {
      segments.push(this.uiSegmentSrv.newPlusButton());
    }
  }
}

/** @ngInject */
function stackdriverFilter() {
  return {
    templateUrl: 'public/app/plugins/datasource/stackdriver/partials/query.filter.html',
    controller: StackdriverFilterCtrl,
    controllerAs: 'ctrl',
    bindToController: true,
    restrict: 'E',
    scope: {
      labelData: '<',
      loading: '<',
      groupBys: '<',
      filters: '<',
      filtersChanged: '&',
      groupBysChanged: '&',
      hideGroupBys: '<',
    },
  };
}

coreModule.directive('stackdriverFilter', stackdriverFilter);
