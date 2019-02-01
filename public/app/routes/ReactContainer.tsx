import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';

import coreModule from 'app/core/core_module';
import { store } from 'app/store/store';
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
  $injector,
  $rootScope,
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
        $injector: $injector,
        $rootScope: $rootScope,
        $scope: scope,
      };

      ReactDOM.render(WrapInProvider(store, component, props), elem[0]);

      scope.$on('$destroy', () => {
        ReactDOM.unmountComponentAtNode(elem[0]);
      });
    },
  };
}

coreModule.directive('reactContainer', reactContainer);
