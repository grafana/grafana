import { TemplateSrv } from 'app/features/templating/template_srv';

export class StackdriverAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
  annotation: any;
  templateSrv: TemplateSrv;

  /** @ngInject */
  constructor(templateSrv: TemplateSrv) {
    this.templateSrv = templateSrv;
    this.annotation.target = this.annotation.target || {};
    this.onQueryChange = this.onQueryChange.bind(this);
  }

  onQueryChange(target: any) {
    Object.assign(this.annotation.target, target);
  }
}
