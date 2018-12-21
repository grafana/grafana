import { react2AngularDirective } from 'app/core/utils/react2angular';
import { QueryEditor } from './components/QueryEditor';

export function registerAngularDirectives() {
  react2AngularDirective('queryEditor', QueryEditor, [
    'target',
    'onQueryChange',
    'onExecuteQuery',
    ['events', { watchDepth: 'reference' }],
    ['uiSegmentSrv', { watchDepth: 'reference' }],
    ['datasource', { watchDepth: 'reference' }],
  ]);
}
