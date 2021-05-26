import { SelectableValue } from '@grafana/data';
import { GrafanaAnnotationType } from './types';

export const annotationTypes: Array<SelectableValue<GrafanaAnnotationType>> = [
  { text: 'Dashboard', value: GrafanaAnnotationType.Dashboard },
  { text: 'Tags', value: GrafanaAnnotationType.Tags },
];

export class GrafanaAnnotationsQueryCtrl {
  declare annotation: any;

  types = annotationTypes;

  /** @ngInject */
  constructor($scope: any) {
    this.annotation = $scope.ctrl.annotation;
    this.annotation.type = this.annotation.type || GrafanaAnnotationType.Tags;
    this.annotation.limit = this.annotation.limit || 100;
  }

  static templateUrl = 'partials/annotations.editor.html';
}
