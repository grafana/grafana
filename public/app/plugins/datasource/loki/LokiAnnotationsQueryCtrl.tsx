import { LokiQuery } from './types';
/**
 * Just a simple wrapper for a react component that is actually implementing the query editor.
 */
export class LokiAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
  declare annotation: any;

  /** @ngInject */
  constructor($scope: any) {
    this.annotation = $scope.ctrl.annotation;
    this.annotation.target = this.annotation.target || {};
    this.onQueryChange = this.onQueryChange.bind(this);
  }

  onQueryChange(query: LokiQuery) {
    this.annotation.expr = query.expr;
    this.annotation.maxLines = query.maxLines;
    this.annotation.instant = query.instant;
  }
}
