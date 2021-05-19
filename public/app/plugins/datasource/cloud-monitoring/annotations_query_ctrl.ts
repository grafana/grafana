import { AnnotationTarget } from './types';

export class CloudMonitoringAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
  declare annotation: any;

  /** @ngInject */
  constructor($scope: any) {
    this.annotation = $scope.ctrl.annotation || {};
    this.annotation.target = $scope.ctrl.annotation.target || {};

    this.onQueryChange = this.onQueryChange.bind(this);
  }

  onQueryChange(target: AnnotationTarget) {
    Object.assign(this.annotation.target, target);
  }
}
