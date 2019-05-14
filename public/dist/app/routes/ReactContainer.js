import * as tslib_1 from "tslib";
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import coreModule from 'app/core/core_module';
import { store } from 'app/store/store';
import { provideTheme } from 'app/core/utils/ConfigProvider';
function WrapInProvider(store, Component, props) {
    return (React.createElement(Provider, { store: store },
        React.createElement(Component, tslib_1.__assign({}, props))));
}
/** @ngInject */
export function reactContainer($route, $location, $injector, $rootScope, contextSrv) {
    return {
        restrict: 'E',
        template: '',
        link: function (scope, elem) {
            // Check permissions for this component
            var roles = $route.current.locals.roles;
            if (roles && roles.length) {
                if (!roles.some(function (r) { return contextSrv.hasRole(r); })) {
                    $location.url('/');
                }
            }
            var component = $route.current.locals.component;
            // Dynamic imports return whole module, need to extract default export
            if (component.default) {
                component = component.default;
            }
            var props = {
                $injector: $injector,
                $rootScope: $rootScope,
                $scope: scope,
                routeInfo: $route.current.$$route.routeInfo,
            };
            document.body.classList.add('is-react');
            ReactDOM.render(WrapInProvider(store, provideTheme(component), props), elem[0]);
            scope.$on('$destroy', function () {
                document.body.classList.remove('is-react');
                ReactDOM.unmountComponentAtNode(elem[0]);
            });
        },
    };
}
coreModule.directive('reactContainer', reactContainer);
//# sourceMappingURL=ReactContainer.js.map