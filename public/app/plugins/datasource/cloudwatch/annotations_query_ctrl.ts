import _ from 'lodash';
import { AnnotationQuery } from './types';

export class CloudWatchAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
  annotation: any;

  /** @ngInject */
  constructor() {
    // this.annotation = {
    //   namespace: '',
    //   metricName: '',
    //   expression: '',
    //   dimensions: {},
    //   region: 'default',
    //   id: '',
    //   alias: '',
    //   statistics: ['Average'],
    //   matchExact: true,
    //   ...this.annotation,
    // };
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
    });

    this.onChange = this.onChange.bind(this);
  }

  onChange(query: AnnotationQuery) {
    Object.assign(this.annotation, query);
  }
}
