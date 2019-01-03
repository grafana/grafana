import { react2AngularDirective } from 'app/core/utils/react2angular';
import { AnnotationQueryEditor } from './components/AnnotationQueryEditor';

export class StackdriverAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
  annotation: any;

  constructor() {
    this.annotation.target = this.annotation.target || {};
    this.handleQueryChange = this.handleQueryChange.bind(this);

    react2AngularDirective('annotationQueryEditor', AnnotationQueryEditor, [
      'target',
      'onQueryChange',
      'onExecuteQuery',
      ['datasource', { watchDepth: 'reference' }],
    ]);
  }

  handleQueryChange(target) {
    Object.assign(this.annotation.target, target);
  }
}
