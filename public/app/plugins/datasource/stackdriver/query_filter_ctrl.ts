import angular from 'angular';
import _ from 'lodash';
import { FilterSegments, DefaultRemoveFilterValue } from './filter_segments';
import appEvents from 'app/core/app_events';

export class StackdriverFilter {
  /** @ngInject */
  constructor() {
    return {
      templateUrl: 'public/app/plugins/datasource/stackdriver/partials/query.filter.html',
      controller: 'StackdriverFilterCtrl',
      controllerAs: 'ctrl',
      restrict: 'E',
      scope: {
        target: '=',
        datasource: '=',
        refresh: '&',
        defaultDropdownValue: '<',
        defaultServiceValue: '<',
        hideGroupBys: '<',
      },
    };
  }
}

export class StackdriverFilterCtrl {
  metricLabels: { [key: string]: string[] };
  resourceLabels: { [key: string]: string[] };

  defaultRemoveGroupByValue = '-- remove group by --';
  loadLabelsPromise: Promise<any>;

  service: string;
  metricType: string;
  metricDescriptors: any[];
  metrics: any[];
  services: any[];
  groupBySegments: any[];
  filterSegments: FilterSegments;
  removeSegment: any;
  target: any;
  datasource: any;

  /** @ngInject */
  constructor(private $scope, private uiSegmentSrv, private templateSrv, private $rootScope) {
    this.datasource = $scope.datasource;
    this.target = $scope.target;
    this.metricType = $scope.defaultDropdownValue;
    this.service = $scope.defaultServiceValue;

    this.metricDescriptors = [];
    this.metrics = [];
    this.services = [];

    this.getCurrentProject()
      .then(this.loadMetricDescriptors.bind(this))
      .then(this.getLabels.bind(this));

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

    this.filterSegments = new FilterSegments(
      this.uiSegmentSrv,
      this.target,
      this.getGroupBys.bind(this, null, null, DefaultRemoveFilterValue, false),
      this.getFilterValues.bind(this)
    );
    this.filterSegments.buildSegmentModel();
  }

  async getCurrentProject() {
    this.target.project = await this.datasource.getDefaultProject();
  }

  async loadMetricDescriptors() {
    if (this.target.project.id !== 'default') {
      this.metricDescriptors = await this.datasource.getMetricTypes(this.target.project.id);
      this.services = this.getServicesList();
      this.metrics = this.getMetricsList();
      return this.metricDescriptors;
    } else {
      return [];
    }
  }

  getServicesList() {
    const defaultValue = { value: this.$scope.defaultServiceValue, text: this.$scope.defaultServiceValue };
    const services = this.metricDescriptors.map(m => {
      return {
        value: m.service,
        text: m.serviceShortName,
      };
    });

    if (services.find(m => m.value === this.target.service)) {
      this.service = this.target.service;
    }

    return services.length > 0 ? [defaultValue, ..._.uniqBy(services, 'value')] : [];
  }

  getMetricsList() {
    const metrics = this.metricDescriptors.map(m => {
      return {
        service: m.service,
        value: m.type,
        serviceShortName: m.serviceShortName,
        text: m.displayName,
        title: m.description,
      };
    });

    let result;
    if (this.target.service === this.$scope.defaultServiceValue) {
      result = metrics.map(m => ({ ...m, text: `${m.service} - ${m.text}` }));
    } else {
      result = metrics.filter(m => m.service === this.target.service);
    }

    if (result.find(m => m.value === this.target.metricType)) {
      this.metricType = this.target.metricType;
    } else if (result.length > 0) {
      this.metricType = this.target.metricType = result[0].value;
    }
    return result;
  }

  async getLabels() {
    this.loadLabelsPromise = new Promise(async resolve => {
      try {
        const data = await this.datasource.getLabels(this.target.metricType, this.target.refId);
        this.metricLabels = data.results[this.target.refId].meta.metricLabels;
        this.resourceLabels = data.results[this.target.refId].meta.resourceLabels;
        resolve();
      } catch (error) {
        if (error.data && error.data.message) {
          console.log(error.data.message);
        } else {
          console.log(error);
        }
        appEvents.emit('alert-error', ['Error', 'Error loading metric labels for ' + this.target.metricType]);
        resolve();
      }
    });
  }

  onServiceChange() {
    this.target.service = this.service;
    this.metrics = this.getMetricsList();
    this.setMetricType();
    this.getLabels();
    if (!this.metrics.find(m => m.value === this.target.metricType)) {
      this.target.metricType = this.$scope.defaultDropdownValue;
    } else {
      this.$scope.refresh();
    }
  }

  async onMetricTypeChange() {
    this.setMetricType();
    this.$scope.refresh();
    this.getLabels();
  }

  setMetricType() {
    this.target.metricType = this.metricType;
    const { valueType, metricKind, unit } = this.metricDescriptors.find(m => m.type === this.target.metricType);
    this.target.unit = unit;
    this.target.valueType = valueType;
    this.target.metricKind = metricKind;
    this.$rootScope.$broadcast('metricTypeChanged');
  }

  async getGroupBys(segment, index, removeText?: string, removeUsed = true) {
    await this.loadLabelsPromise;

    const metricLabels = Object.keys(this.metricLabels || {})
      .filter(ml => {
        if (!removeUsed) {
          return true;
        }
        return this.target.aggregation.groupBys.indexOf('metric.label.' + ml) === -1;
      })
      .map(l => {
        return this.uiSegmentSrv.newSegment({
          value: `metric.label.${l}`,
          expandable: false,
        });
      });

    const resourceLabels = Object.keys(this.resourceLabels || {})
      .filter(ml => {
        if (!removeUsed) {
          return true;
        }

        return this.target.aggregation.groupBys.indexOf('resource.label.' + ml) === -1;
      })
      .map(l => {
        return this.uiSegmentSrv.newSegment({
          value: `resource.label.${l}`,
          expandable: false,
        });
      });

    const noValueOrPlusButton = !segment || segment.type === 'plus-button';
    if (noValueOrPlusButton && metricLabels.length === 0 && resourceLabels.length === 0) {
      return Promise.resolve([]);
    }

    this.removeSegment.value = removeText || this.defaultRemoveGroupByValue;
    return Promise.resolve([...metricLabels, ...resourceLabels, this.removeSegment]);
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
    const hasNoFilterKeys = this.metricLabels && Object.keys(this.metricLabels).length === 0;
    return this.filterSegments.getFilters(segment, index, hasNoFilterKeys);
  }

  getFilterValues(index) {
    const filterKey = this.templateSrv.replace(this.filterSegments.filterSegments[index - 2].value);
    if (!filterKey || !this.metricLabels || Object.keys(this.metricLabels).length === 0) {
      return [];
    }

    const shortKey = filterKey.substring(filterKey.indexOf('.label.') + 7);

    if (filterKey.startsWith('metric.label.') && this.metricLabels.hasOwnProperty(shortKey)) {
      return this.metricLabels[shortKey];
    }

    if (filterKey.startsWith('resource.label.') && this.resourceLabels.hasOwnProperty(shortKey)) {
      return this.resourceLabels[shortKey];
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

angular.module('grafana.controllers').directive('stackdriverFilter', StackdriverFilter);
angular.module('grafana.controllers').controller('StackdriverFilterCtrl', StackdriverFilterCtrl);
