import { AnnotationQuery } from './types';

export class CloudWatchAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
  annotation: any;

  /** @ngInject */
  constructor() {
    this.annotation.target = this.annotation.target || {};
    this.onChange = this.onChange.bind(this);
  }

  onChange(target: AnnotationQuery) {
    Object.assign(this.annotation.target, target);
  }
}
