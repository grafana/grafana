import _ from 'lodash';
import { AnnotationQuery } from './types';

export class CloudWatchAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
  annotation: any;

  /** @ngInject */
  constructor() {
    _.defaultsDeep(this.annotation, {
      namespace: '',
      metricName: '',
      expression: '',
      dimensions: {},
      region: 'default',
      id: '',
      alias: '',
      statistics: ['Average'],
      matchExact: true,
      prefixMatching: false,
      actionPrefix: '',
      alarmNamePrefix: '',
    });

    this.onChange = this.onChange.bind(this);
  }

  onChange(query: AnnotationQuery) {
    Object.assign(this.annotation, query);
  }
}
