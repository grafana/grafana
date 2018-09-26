import _ from 'lodash';
import { QueryCtrl } from 'app/plugins/sdk';
import appEvents from 'app/core/app_events';
import { FilterSegments, DefaultRemoveFilterValue } from './filter_segments';
import './query_aggregation_ctrl';

export interface QueryMeta {
  rawQuery: string;
  rawQueryString: string;
  metricLabels: { [key: string]: string[] };
  resourceLabels: { [key: string]: string[] };
}

export class StackdriverQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';
  target: {
    project: {
      id: string;
      name: string;
    };
    metricType: string;
    service: string;
    refId: string;
    aggregation: {
      crossSeriesReducer: string;
      alignmentPeriod: string;
      perSeriesAligner: string;
      groupBys: string[];
    };
    filters: string[];
    aliasBy: string;
    metricKind: any;
    valueType: any;
  };
  defaultDropdownValue = 'Select Metric';
  defaultServiceValue = 'All Services';
  defaultRemoveGroupByValue = '-- remove group by --';
  loadLabelsPromise: Promise<any>;
  stackdriverConstants;

  defaults = {
    project: {
      id: 'default',
      name: 'loading project...',
    },
    metricType: this.defaultDropdownValue,
    service: this.defaultServiceValue,
    metric: '',
    aggregation: {
      crossSeriesReducer: 'REDUCE_MEAN',
      alignmentPeriod: 'auto',
      perSeriesAligner: 'ALIGN_MEAN',
      groupBys: [],
    },
    filters: [],
    showAggregationOptions: false,
    aliasBy: '',
    metricKind: '',
    valueType: '',
  };

  service: string;
  metricType: string;
  metricDescriptors: any[];
  metrics: any[];
  services: any[];
  groupBySegments: any[];
  removeSegment: any;
  showHelp: boolean;
  showLastQuery: boolean;
  lastQueryMeta: QueryMeta;
  lastQueryError?: string;
  metricLabels: { [key: string]: string[] };
  resourceLabels: { [key: string]: string[] };
  filterSegments: any;

  /** @ngInject */
  constructor($scope, $injector, private uiSegmentSrv, private templateSrv) {
    super($scope, $injector);
    _.defaultsDeep(this.target, this.defaults);
    this.metricDescriptors = [];
    this.metrics = [];
    this.services = [];
    this.metricType = this.defaultDropdownValue;
    this.service = this.defaultServiceValue;
    this.panelCtrl.events.on('data-received', this.onDataReceived.bind(this), $scope);
    this.panelCtrl.events.on('data-error', this.onDataError.bind(this), $scope);
    this.getCurrentProject()
      .then(this.loadMetricDescriptors.bind(this))
      .then(this.getLabels.bind(this));
    this.initSegments();
  }

  initSegments() {
    this.groupBySegments = this.target.aggregation.groupBys.map(groupBy => {
      return this.uiSegmentSrv.getSegmentForValue(groupBy);
    });
    this.removeSegment = this.uiSegmentSrv.newSegment({ fake: true, value: '-- remove group by --' });
    this.ensurePlusButton(this.groupBySegments);

    this.filterSegments = new FilterSegments(
      this.uiSegmentSrv,
      this.target,
      this.getGroupBys.bind(this, null, null, DefaultRemoveFilterValue, false),
      this.getFilterValues.bind(this)
    );
    this.filterSegments.buildSegmentModel();
  }

  async getCurrentProject() {
    try {
      this.target.project = await this.datasource.getDefaultProject();
    } catch (error) {
      let message = 'Projects cannot be fetched: ';
      message += error.statusText ? error.statusText + ': ' : '';
      if (error && error.data && error.data.error && error.data.error.message) {
        if (error.data.error.code === 403) {
          message += `
            A list of projects could not be fetched from the Google Cloud Resource Manager API.
            You might need to enable it first:
            https://console.developers.google.com/apis/library/cloudresourcemanager.googleapis.com`;
        } else {
          message += error.data.error.code + '. ' + error.data.error.message;
        }
      } else {
        message += 'Cannot connect to Stackdriver API';
      }
      appEvents.emit('ds-request-error', message);
    }
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
    const defaultValue = { value: this.defaultServiceValue, text: this.defaultServiceValue };
    const services = this.metricDescriptors.map(m => {
      const [service] = m.type.split('/');
      const [serviceShortName] = service.split('.');
      return {
        value: service,
        text: serviceShortName,
      };
    });

    if (services.find(m => m.value === this.target.service)) {
      this.service = this.target.service;
    }

    return services.length > 0 ? [defaultValue, ..._.uniqBy(services, 'value')] : [];
  }

  getMetricsList() {
    const metrics = this.metricDescriptors.map(m => {
      const [service] = m.type.split('/');
      const [serviceShortName] = service.split('.');
      return {
        service,
        value: m.type,
        serviceShortName,
        text: m.displayName,
        title: m.description,
      };
    });

    let result;
    if (this.target.service === this.defaultServiceValue) {
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
        console.log(error.data.message);
        appEvents.emit('alert-error', ['Error', 'Error loading metric labels for ' + this.target.metricType]);
        resolve();
      }
    });
  }

  onServiceChange() {
    this.target.service = this.service;
    this.metrics = this.getMetricsList();
    this.setMetricType();
    if (!this.metrics.find(m => m.value === this.target.metricType)) {
      this.target.metricType = this.defaultDropdownValue;
    } else {
      this.refresh();
    }
  }

  async onMetricTypeChange() {
    this.setMetricType();
    this.refresh();
    this.getLabels();
  }

  setMetricType() {
    this.target.metricType = this.metricType;
    const { valueType, metricKind } = this.metricDescriptors.find(m => m.type === this.target.metricType);
    this.target.valueType = valueType;
    this.target.metricKind = metricKind;
    this.$scope.$broadcast('metricTypeChanged');
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
    this.refresh();
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
    this.refresh();
  }

  ensurePlusButton(segments) {
    const count = segments.length;
    const lastSegment = segments[Math.max(count - 1, 0)];

    if (!lastSegment || lastSegment.type !== 'plus-button') {
      segments.push(this.uiSegmentSrv.newPlusButton());
    }
  }

  onDataReceived(dataList) {
    this.lastQueryError = null;
    this.lastQueryMeta = null;

    const anySeriesFromQuery: any = _.find(dataList, { refId: this.target.refId });
    if (anySeriesFromQuery) {
      this.lastQueryMeta = anySeriesFromQuery.meta;
      this.lastQueryMeta.rawQueryString = decodeURIComponent(this.lastQueryMeta.rawQuery);
    }
  }

  onDataError(err) {
    if (err.data && err.data.results) {
      const queryRes = err.data.results[this.target.refId];
      if (queryRes && queryRes.error) {
        this.lastQueryMeta = queryRes.meta;
        this.lastQueryMeta.rawQueryString = decodeURIComponent(this.lastQueryMeta.rawQuery);

        let jsonBody;
        try {
          jsonBody = JSON.parse(queryRes.error);
        } catch {
          this.lastQueryError = queryRes.error;
        }

        this.lastQueryError = jsonBody.error.message;
      }
    }
    console.error(err);
  }
}
