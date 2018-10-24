import _ from 'lodash';
import coreModule from 'app/core/core_module';
import { importPluginModule } from './plugin_loader';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import DefaultTemplateQueryCtrl from '../templating/defaultTemplateQueryCtrl';

function WrapInProvider(Component, props) {
  return (
    <Provider>
      <Component {...props} />
    </Provider>
  );
}

async function loadComponent(module) {
  const component = await importPluginModule(module);
  if (!component.TemplateQueryCtrl) {
    return DefaultTemplateQueryCtrl;
  } else {
    return component.TemplateQueryCtrl;
  }
}

/** @ngInject */
function pluginTemplateQueryComponentLoader(datasourceSrv) {
  return {
    restrict: 'E',
    link: async (scope, elem) => {
      const component = await loadComponent(scope.currentDatasource.meta.module);
      const props = { datasourceSrv, query: scope.current.query, isValid: scope.current.isValid };
      ReactDOM.render(WrapInProvider(component, props), elem[0]);
      scope.$on('$destroy', () => {
        ReactDOM.unmountComponentAtNode(elem[0]);
      });
    },
  };
}

coreModule.directive('pluginTemplateQueryComponent', pluginTemplateQueryComponentLoader);
