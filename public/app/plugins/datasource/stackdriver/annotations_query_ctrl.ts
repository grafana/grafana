import _ from 'lodash';
import './query_filter_ctrl';

export class StackdriverAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
  annotation: any;
  datasource: any;

  defaultDropdownValue = 'Select Metric';
  defaultServiceValue = 'All Services';

  defaults = {
    project: {
      id: 'default',
      name: 'loading project...',
    },
    metricType: this.defaultDropdownValue,
    service: this.defaultServiceValue,
    metric: '',
    filters: [],
    metricKind: '',
    valueType: '',
  };

  /** @ngInject */
  constructor() {
    this.annotation.target = this.annotation.target || {};
    this.annotation.target.refId = 'annotationQuery';
    _.defaultsDeep(this.annotation.target, this.defaults);
  }
}
