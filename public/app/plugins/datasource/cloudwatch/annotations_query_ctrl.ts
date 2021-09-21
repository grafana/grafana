import { defaultsDeep } from 'lodash';
import { CloudWatchAnnotationQuery } from './types';

export class CloudWatchAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
  declare annotation: any;

  /** @ngInject */
  constructor($scope: any) {
    this.annotation = $scope.ctrl.annotation;

    defaultsDeep(this.annotation, {
      namespace: '',
      metricName: '',
      expression: '',
      dimensions: {},
      region: 'default',
      id: '',
      alias: '',
      statistic: 'Average',
      matchExact: true,
      prefixMatching: false,
      actionPrefix: '',
      alarmNamePrefix: '',
    });

    this.onChange = this.onChange.bind(this);
  }

  onChange(query: CloudWatchAnnotationQuery) {
    Object.assign(this.annotation, query);
  }
}
