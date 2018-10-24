import _ from 'lodash';
import coreModule from 'app/core/core_module';
import { importPluginModule } from './plugin_loader';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';

function WrapInProvider(Component, props) {
  return (
    <Provider>
      <Component {...props} />
    </Provider>
  );
}

/** @ngInject */
function pluginReactDirectiveLoader($compile, datasourceSrv, $rootScope, $q, $http, $templateCache, $timeout) {
  async function getModule(scope, attrs) {
    switch (attrs.type) {
      case 'template-query-ctrl': {
        const dsModule = await importPluginModule(scope.currentDatasource.meta.module);
        console.log(dsModule);
        return dsModule.TemplateQueryCtrl;
      }
      default: {
        return $q.reject({
          message: 'Could not find component type: ' + attrs.type,
        });
      }
    }
  }

  return {
    restrict: 'E',
    link: async (scope, elem, attrs) => {
      const component = await getModule(scope, attrs);
      const props = { datasourceSrv };
      ReactDOM.render(WrapInProvider(component, props), elem[0]);

      scope.$on('$destroy', () => {
        ReactDOM.unmountComponentAtNode(elem[0]);
      });
    },
  };
}

coreModule.directive('pluginReactComponent', pluginReactDirectiveLoader);
