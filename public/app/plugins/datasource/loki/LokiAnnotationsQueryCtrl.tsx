import { LokiQuery } from './types';
/**
 * Just a simple wrapper for a react component that is actually implementing the query editor.
 */
export class LokiAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
  annotation: any;

  /** @ngInject */
  constructor() {
    this.annotation.target = this.annotation.target || {};
    this.annotation.query = this.annotation.query || {};
    this.onQueryChange = this.onQueryChange.bind(this);
  }

  onQueryChange(query: LokiQuery) {
    this.annotation.query = query;
  }
}
