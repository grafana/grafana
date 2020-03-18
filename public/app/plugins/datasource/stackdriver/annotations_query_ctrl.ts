import { TemplateSrv } from 'app/features/templating/template_srv';
import { AnnotationTarget } from './types';

export class StackdriverAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
  annotation: any;
  templateSrv: TemplateSrv;

  /** @ngInject */
  constructor() {
    this.annotation.target = this.annotation.target || {};
    this.onQueryChange = this.onQueryChange.bind(this);
  }

  onQueryChange(target: AnnotationTarget) {
    Object.assign(this.annotation.target, target);
  }
}
