import React from 'react';
import ReactDOM from 'react-dom';
import coreModule from 'app/core/core_module';
import { store } from 'app/stores/store';
import { Provider } from 'mobx-react';

function WrapInProvider(store, Component, props) {
  return (
    <Provider store={store}>
      <Component {...props} />
    </Provider>
  );
}

/** @ngInject */
export function reactContainer($route) {
  return {
    restrict: 'E',
    template: '<h2>hasad</h2>',
    link(scope, elem) {
      let component = $route.current.locals.component;
      let props = {};

      ReactDOM.render(WrapInProvider(store, component, props), elem[0]);

      scope.$on('$destroy', function() {
        ReactDOM.unmountComponentAtNode(elem[0]);
      });
    },
  };
}

coreModule.directive('reactContainer', reactContainer);
