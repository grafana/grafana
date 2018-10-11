import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';

import coreModule from 'app/core/core_module';
import { store } from 'app/store/configureStore';
import { BackendSrv } from 'app/core/services/backend_srv';
import { DatasourceSrv } from 'app/features/plugins/datasource_srv';
import { ContextSrv } from 'app/core/services/context_srv';

function WrapInProvider(store, Component, props) {
  return (
    <Provider store={store}>
      <Component {...props} />
    </Provider>
  );
}

/** @ngInject */
export function reactContainer(
  $route,
  $location,
  backendSrv: BackendSrv,
  datasourceSrv: DatasourceSrv,
  contextSrv: ContextSrv
) {
  return {
    restrict: 'E',
    template: '',
    link(scope, elem) {
      // Check permissions for this component
      const { roles } = $route.current.locals;
      if (roles && roles.length) {
        if (!roles.some(r => contextSrv.hasRole(r))) {
          $location.url('/');
        }
      }

      let { component } = $route.current.locals;
      // Dynamic imports return whole module, need to extract default export
      if (component.default) {
        component = component.default;
      }

      const props = {
        backendSrv: backendSrv,
        datasourceSrv: datasourceSrv,
        routeParams: $route.current.params,
      };

      ReactDOM.render(WrapInProvider(store, component, props), elem[0]);

      scope.$on('$destroy', () => {
        ReactDOM.unmountComponentAtNode(elem[0]);
      });
    },
  };
}

coreModule.directive('reactContainer', reactContainer);
