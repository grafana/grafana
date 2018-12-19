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
    this.handleMetricTypeChange = this.handleMetricTypeChange.bind(this);
    this.handleServiceChange = this.handleServiceChange.bind(this);
  }

  handleMetricTypeChange(value) {
    this.target.metricType = value;
    this.setMetricType();
    this.$scope.refresh();
    // this.getLabels();
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

  // async getCurrentProject() {
  //   return new Promise(async (resolve, reject) => {
  //     try {
  //       if (!this.target.defaultProject || this.target.defaultProject === 'loading project...') {
  //         this.target.defaultProject = await this.datasource.getDefaultProject();
  //       }
  //       resolve(this.target.defaultProject);
  //     } catch (error) {
  //       appEvents.emit('ds-request-error', error);
  //       reject();
  //     }
  //   });
  // }

  // async loadMetricDescriptors() {
  //   if (this.target.defaultProject !== 'loading project...') {
  //     this.metricDescriptors = await this.datasource.getMetricTypes(this.target.defaultProject);
  //     this.services = this.getServicesList();
  //     this.metrics = this.getMetricsList();
  //     return this.metricDescriptors;
  //   } else {
  //     return [];
  //   }
  // }

  getServicesList() {
    const services = this.metricDescriptors.map(m => ({
      value: m.service,
      label: _.startCase(m.serviceShortName),
    }));

    return services.length > 0 ? _.uniqBy(services, s => s.value) : [];
  }

  getMetricsList() {
    const metricsByService = this.metricDescriptors.filter(m => m.service === this.target.service).map(m => ({
      service: m.service,
      value: m.type,
      label: m.displayName,
      description: m.description,
    }));

    if (
      metricsByService.length > 0 &&
      !metricsByService.some(m => m.value === this.templateSrv.replace(this.target.metricType))
    ) {
      this.target.metricType = metricsByService[0].value;
    }
    return metricsByService;
  }

  // async getLabels() {
  //   this.loadLabelsPromise = new Promise(async resolve => {
  //     try {
  //       if (this.target.metricType) {
  //         const { meta } = await this.datasource.getLabels(this.target.metricType, this.target.refId);
  //         this.metricLabels = meta.metricLabels;
  //         this.resourceLabels = meta.resourceLabels;
  //         this.resourceTypes = meta.resourceTypes;
  //         resolve();
  //       } else {
  //         resolve();
  //       }
  //     } catch (error) {
  //       appEvents.emit('alert-error', ['Error', 'Error loading metric labels for ' + this.target.metricType]);
  //       resolve();
  //     }
  //   });
  // }

  handleServiceChange(service) {
    this.target.service = service;
    this.metrics = this.getMetricsList();
    this.setMetricType();
    // this.getLabels();
    if (!this.metrics.some(m => m.value === this.target.metricType)) {
      this.target.metricType = '';
    } else {
      this.$scope.refresh();
    }
  }

  setMetricType() {
    const metric = this.metricDescriptors.find(m => m.type === this.templateSrv.replace(this.target.metricType));
    if (metric) {
      const { valueType, metricKind, unit } = metric;
      this.target.unit = unit;
      this.target.valueType = valueType;
      this.target.metricKind = metricKind;
      this.$rootScope.$broadcast('metricTypeChanged');
    }
  }

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
