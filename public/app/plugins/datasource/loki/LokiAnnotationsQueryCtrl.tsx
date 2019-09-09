/**
 * Just a simple wrapper for a react component that is actually implementing the query editor.
 */
export class LokiAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
  annotation: any;

  /** @ngInject */
  constructor() {
    this.annotation.target = this.annotation.target || {};
    this.onQueryChange = this.onQueryChange.bind(this);
  }

  onQueryChange(expr: string) {
    this.annotation.expr = expr;
  }
}
