import { AnnotationTarget } from './types';

export class CloudMonitoringAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
  annotation: any;

  constructor() {
    this.annotation.target = this.annotation.target || {};
    this.onQueryChange = this.onQueryChange.bind(this);
  }

  onQueryChange(target: AnnotationTarget) {
    Object.assign(this.annotation.target, target);
  }
}
