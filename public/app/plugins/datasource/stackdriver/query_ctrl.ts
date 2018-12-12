import _ from 'lodash';
import appEvents from 'app/core/app_events';
import { QueryCtrl } from 'app/plugins/sdk';
import './query_aggregation_ctrl';
import './query_filter_ctrl';
import { MetricPicker } from './components/MetricPicker';
import { OptionPicker } from './components/OptionPicker';
import { OptionGroupPicker } from './components/OptionGroupPicker';
import { react2AngularDirective } from 'app/core/utils/react2angular';

export interface QueryMeta {
  alignmentPeriod: string;
  rawQuery: string;
  rawQueryString: string;
  metricLabels: { [key: string]: string[] };
  resourceLabels: { [key: string]: string[] };
}

export class StackdriverQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';
  target: {
    defaultProject: string;
    unit: string;
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

  defaults = {
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

  showHelp: boolean;
  showLastQuery: boolean;
  lastQueryMeta: QueryMeta;
  lastQueryError?: string;
  labelData: QueryMeta;

  loadLabelsPromise: Promise<any>;
  templateSrv: any;

  /** @ngInject */
  constructor($scope, $injector, templateSrv, private $rootScope) {
    super($scope, $injector);
    this.templateSrv = templateSrv;
    _.defaultsDeep(this.target, this.defaults);
    this.panelCtrl.events.on('data-received', this.onDataReceived.bind(this), $scope);
    this.panelCtrl.events.on('data-error', this.onDataError.bind(this), $scope);
    this.handleMetricTypeChange = this.handleMetricTypeChange.bind(this);
    react2AngularDirective('optionPicker', OptionPicker, [
      'options',
      'onChange',
      'selected',
      'searchable',
      'className',
      'placeholder',
    ]);
    react2AngularDirective('optionGroupPicker', OptionGroupPicker, [
      'groups',
      'onChange',
      'selected',
      'searchable',
      'className',
      'placeholder',
    ]);
    react2AngularDirective('metricPicker', MetricPicker, [
      'target',
      ['onChange', { watchDepth: 'reference' }],
      'defaultProject',
      'metricType',
      ['templateSrv', { watchDepth: 'reference' }],
      ['datasource', { watchDepth: 'reference' }],
    ]);
    this.getLabels();
  }

  handleMetricTypeChange({ valueType, metricKind, type, unit }) {
    this.target.metricType = type;
    this.target.unit = unit;
    this.target.valueType = valueType;
    this.target.metricKind = metricKind;
    this.$rootScope.$broadcast('metricTypeChanged');
    this.getLabels();
    this.refresh();
  }

  async getLabels() {
    this.loadLabelsPromise = new Promise(async resolve => {
      try {
        const { meta } = await this.datasource.getLabels(this.target.metricType, this.target.refId);
        this.labelData = meta;
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
