import _ from 'lodash';
import { QueryCtrl } from 'app/plugins/sdk';
import './query_aggregation_ctrl';
import './query_filter_ctrl';
import { StackdriverPicker } from './components/StackdriverPicker';
import { react2AngularDirective } from 'app/core/utils/react2angular';
import { registerAngularDirectives } from './angular_wrappers';
import { Target, QueryMeta } from './types';

export const DefaultTarget = {
  defaultProject: 'loading project...',
  metricType: '',
  service: '',
  metric: '',
  unit: '',
  crossSeriesReducer: 'REDUCE_MEAN',
  alignmentPeriod: 'stackdriver-auto',
  perSeriesAligner: 'ALIGN_MEAN',
  groupBys: [],
  filters: [],
  showAggregationOptions: false,
  aliasBy: '',
  metricKind: '',
  valueType: '',
};

export class StackdriverQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';
  target: Target;

  defaults = {
    defaultProject: 'loading project...',
    metricType: '',
    service: '',
    metric: '',
    unit: '',
    crossSeriesReducer: 'REDUCE_MEAN',
    alignmentPeriod: 'stackdriver-auto',
    perSeriesAligner: 'ALIGN_MEAN',
    groupBys: [],
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
  $rootScope: any;
  uiSegmentSrv: any;

  /** @ngInject */
  constructor($scope, $injector, templateSrv, $rootScope, uiSegmentSrv) {
    super($scope, $injector);
    this.templateSrv = templateSrv;
    this.$rootScope = $rootScope;
    this.uiSegmentSrv = uiSegmentSrv;
    _.defaultsDeep(this.target, this.defaults);
    react2AngularDirective('stackdriverPicker', StackdriverPicker, [
      'options',
      'onChange',
      'selected',
      'searchable',
      'className',
      'placeholder',
      'groupName',
      ['templateVariables', { watchDepth: 'reference' }],
    ]);
    registerAngularDirectives();
  }

  handleQueryChange(target: Target) {
    Object.assign(this.target, target);
  }

  handleExecuteQuery() {
    this.$scope.ctrl.refresh();
  }
}
