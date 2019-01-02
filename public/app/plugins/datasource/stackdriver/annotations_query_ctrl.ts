import _ from 'lodash';
import './query_filter_ctrl';
import { react2AngularDirective } from 'app/core/utils/react2angular';
import { AnnotationQueryEditor } from './components/AnnotationQueryEditor';

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
    this.handleQueryChange = this.handleQueryChange.bind(this);

    react2AngularDirective('annotationQueryEditor', AnnotationQueryEditor, [
      'target',
      'onQueryChange',
      'onExecuteQuery',
      ['datasource', { watchDepth: 'reference' }],
    ]);
  }

  handleQueryChange(target) {
    Object.assign(this.annotation.target, target);
  }
}
