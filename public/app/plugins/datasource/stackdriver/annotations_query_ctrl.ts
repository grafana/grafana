export class StackdriverAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
  annotation: any;
  templateSrv: any;

  /** @ngInject */
  constructor(templateSrv) {
    this.templateSrv = templateSrv;
    this.annotation.target = this.annotation.target || {};
    this.onQueryChange = this.onQueryChange.bind(this);
  }

  onQueryChange(target) {
    Object.assign(this.annotation.target, target);
  }
}
