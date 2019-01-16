import coreModule from 'app/core/core_module';
import { importPluginModule } from './plugin_loader';
import React from 'react';
import ReactDOM from 'react-dom';
import DefaultVariableQueryEditor from '../templating/DefaultVariableQueryEditor';

async function loadComponent(module) {
  const component = await importPluginModule(module);
  if (component && component.VariableQueryEditor) {
    return component.VariableQueryEditor;
  } else {
    return DefaultVariableQueryEditor;
  }
}

/** @ngInject */
function variableQueryEditorLoader(templateSrv) {
  return {
    restrict: 'E',
    link: async (scope, elem) => {
      const Component = await loadComponent(scope.currentDatasource.meta.module);
      const props = {
        datasource: scope.currentDatasource,
        query: scope.current.query,
        onChange: scope.onQueryChange,
        templateSrv,
      };
      ReactDOM.render(<Component {...props} />, elem[0]);
      scope.$on('$destroy', () => {
        ReactDOM.unmountComponentAtNode(elem[0]);
      });
    },
  };
}

coreModule.directive('variableQueryEditorLoader', variableQueryEditorLoader);
