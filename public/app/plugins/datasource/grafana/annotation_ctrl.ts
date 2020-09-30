import { SelectableValue } from '@grafana/data';
import { GrafanaAnnotationType } from './types';

export const annotationTypes: Array<SelectableValue<GrafanaAnnotationType>> = [
  { text: 'Dashboard', value: GrafanaAnnotationType.Dashboard },
  { text: 'Tags', value: GrafanaAnnotationType.Tags },
];

export class GrafanaAnnotationsQueryCtrl {
  annotation: any;

  types = annotationTypes;

  constructor() {
    this.annotation.type = this.annotation.type || GrafanaAnnotationType.Tags;
    this.annotation.limit = this.annotation.limit || 100;
  }

  static templateUrl = 'partials/annotations.editor.html';
}
