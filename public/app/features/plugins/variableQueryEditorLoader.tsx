import coreModule from 'app/core/core_module';
import { importDataSourcePlugin } from './plugin_loader';
import React from 'react';
import ReactDOM from 'react-dom';
import DefaultVariableQueryEditor from '../variables/editor/DefaultVariableQueryEditor';
import { DataSourcePluginMeta } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';

async function loadComponent(meta: DataSourcePluginMeta) {
  const dsPlugin = await importDataSourcePlugin(meta);
  if (dsPlugin.components.VariableQueryEditor) {
    return dsPlugin.components.VariableQueryEditor;
  } else {
    return DefaultVariableQueryEditor;
  }
}

/** @ngInject */
function variableQueryEditorLoader(templateSrv: TemplateSrv) {
  return {
    restrict: 'E',
    link: async (scope: any, elem: JQuery) => {
      const Component = await loadComponent(scope.currentDatasource.meta);
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
