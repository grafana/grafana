import coreModule from 'app/core/core_module';
import { importPluginModule } from './plugin_loader';
import React from 'react';
import ReactDOM from 'react-dom';
import DefaultTemplateQueryCtrl from '../templating/defaultTemplateQueryCtrl';

async function loadComponent(module) {
  const component = await importPluginModule(module);
  if (!component.TemplateQueryCtrl) {
    return DefaultTemplateQueryCtrl;
  } else {
    return component.TemplateQueryCtrl;
  }
}

/** @ngInject */
function pluginTemplateQueryComponentLoader() {
  return {
    restrict: 'E',
    link: async (scope, elem) => {
      const Component = await loadComponent(scope.currentDatasource.meta.module);
      const props = {
        datasource: scope.currentDatasource,
        query: scope.current.query,
        onChange: scope.onQueryChange,
      };
      ReactDOM.render(<Component {...props} />, elem[0]);
      scope.$on('$destroy', () => {
        ReactDOM.unmountComponentAtNode(elem[0]);
      });
    },
  };
}

coreModule.directive('pluginTemplateQueryComponent', pluginTemplateQueryComponentLoader);
