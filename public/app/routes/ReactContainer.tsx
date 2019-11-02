// Libraries
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';

// Utils and services
import coreModule from 'app/core/core_module';
import { store } from 'app/store/store';
import { ContextSrv } from 'app/core/services/context_srv';
import { provideTheme } from 'app/core/utils/ConfigProvider';
import { ErrorBoundaryAlert } from '@grafana/ui';
import { GrafanaRootScope } from './GrafanaCtrl';

function WrapInProvider(store: any, Component: any, props: any) {
  return (
    <Provider store={store}>
      <ErrorBoundaryAlert style="page">
        <Component {...props} />
      </ErrorBoundaryAlert>
    </Provider>
  );
}

/** @ngInject */
export function reactContainer(
  $route: any,
  $location: any,
  $injector: any,
  $rootScope: GrafanaRootScope,
  contextSrv: ContextSrv
) {
  return {
    restrict: 'E',
    template: '',
    link(scope: any, elem: JQuery) {
      // Check permissions for this component
      const roles: string[] = $route.current.locals.roles;
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
        $contextSrv: contextSrv,
        routeInfo: $route.current.$$route.routeInfo,
      };

      document.body.classList.add('is-react');

      ReactDOM.render(WrapInProvider(store, provideTheme(component), props), elem[0]);

      scope.$on('$destroy', () => {
        document.body.classList.remove('is-react');
        ReactDOM.unmountComponentAtNode(elem[0]);
      });
    },
  };
}

coreModule.directive('reactContainer', reactContainer);
