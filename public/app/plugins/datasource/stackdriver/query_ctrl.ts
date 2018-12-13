import _ from 'lodash';
import appEvents from 'app/core/app_events';
import { QueryCtrl } from 'app/plugins/sdk';
import './query_aggregation_ctrl';
import './query_filter_ctrl';
import { registerAngularDirectives } from './angular_wrappers';
import { Target, QueryMeta } from './types';

export const DefaultTarget = {
  defaultProject: 'loading project...',
  metricType: '',
  service: '',
  metric: '',
  unit: '',
  aggregation: {
    crossSeriesReducer: 'REDUCE_MEAN',
    alignmentPeriod: 'stackdriver-auto',
    perSeriesAligner: 'ALIGN_MEAN',
    groupBys: [],
  },
  filters: [],
  showAggregationOptions: false,
  aliasBy: '',
  metricKind: '',
  valueType: '',
};

export class StackdriverQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';
  target: Target;

  defaults = DefaultTarget;

  showHelp: boolean;
  showLastQuery: boolean;
  lastQueryMeta: QueryMeta;
  lastQueryError?: string;
  labelData: QueryMeta;

  loadLabelsPromise: Promise<any>;
  templateSrv: any;
  $rootScope: any;
  uiSegmentSrv: any;

  /** @ngInject */
  constructor($scope, $injector, templateSrv, $rootScope, uiSegmentSrv) {
    super($scope, $injector);
    this.templateSrv = templateSrv;
    this.$rootScope = $rootScope;
    this.uiSegmentSrv = uiSegmentSrv;
    _.defaultsDeep(this.target, this.defaults);
    this.panelCtrl.events.on('data-received', this.onDataReceived.bind(this), $scope);
    this.panelCtrl.events.on('data-error', this.onDataError.bind(this), $scope);
    // this.handleMetricTypeChange = this.handleMetricTypeChange.bind(this);
    // this.handleAggregationChange = this.handleAggregationChange.bind(this);
    this.handleTargetChange = this.handleTargetChange.bind(this);
    registerAngularDirectives();
    // this.getLabels();
  }

  // handleMetricTypeChange({ valueType, metricKind, type, unit }) {
  //   this.target.metricType = type;
  //   this.target.unit = unit;
  //   this.target.valueType = valueType;
  //   this.target.metricKind = metricKind;
  //   this.$rootScope.$broadcast('metricTypeChanged');
  //   this.getLabels();
  //   this.refresh();
  // }

  // handleAggregationChange(crossSeriesReducer) {
  //   this.target.aggregation.crossSeriesReducer = crossSeriesReducer;
  //   this.refresh();
  // }
  handleTargetChange(target: Target) {
    console.log(target);
  }

  async getLabels() {
    this.loadLabelsPromise = new Promise(async resolve => {
      try {
        const { meta } = await this.datasource.getLabels(this.target.metricType, this.target.refId);
        this.labelData = meta;
        resolve();
      } catch (error) {
        appEvents.emit('alert-error', ['Error', 'Error loading metric labels for ' + this.target.metricType]);
        resolve();
      }
    });
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
  }
}
