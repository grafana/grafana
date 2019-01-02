import { react2AngularDirective } from 'app/core/utils/react2angular';
import { QueryEditor } from './components/QueryEditor';
import { AnnotationQueryEditor } from './components/AnnotationQueryEditor';

//This should be removed when the plugin is fully reactified
export function registerAngularDirectives() {
  react2AngularDirective('queryEditor', QueryEditor, [
    'target',
    'onQueryChange',
    'onExecuteQuery',
    ['events', { watchDepth: 'reference' }],
    ['datasource', { watchDepth: 'reference' }],
  ]);
  react2AngularDirective('annotationQueryEditor', AnnotationQueryEditor, [
    'target',
    'onQueryChange',
    'onExecuteQuery',
    ['datasource', { watchDepth: 'reference' }],
  ]);
}
