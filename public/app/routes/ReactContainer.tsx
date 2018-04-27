import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'mobx-react';

import coreModule from 'app/core/core_module';
import { store } from 'app/stores/store';
import { BackendSrv } from 'app/core/services/backend_srv';
import { DatasourceSrv } from 'app/features/plugins/datasource_srv';

function WrapInProvider(store, Component, props) {
  return (
    <Provider {...store}>
      <Component {...props} />
    </Provider>
  );
}

/** @ngInject */
export function reactContainer($route, $location, backendSrv: BackendSrv, datasourceSrv: DatasourceSrv) {
  return {
    restrict: 'E',
    template: '',
    link(scope, elem) {
      let component = $route.current.locals.component;
      // Dynamic imports return whole module, need to extract default export
      if (component.default) {
        component = component.default;
      }
      const props = {
        backendSrv: backendSrv,
        datasourceSrv: datasourceSrv,
      };

      ReactDOM.render(WrapInProvider(store, component, props), elem[0]);

      scope.$on('$destroy', function() {
        ReactDOM.unmountComponentAtNode(elem[0]);
      });
    },
  };
}

coreModule.directive('reactContainer', reactContainer);
