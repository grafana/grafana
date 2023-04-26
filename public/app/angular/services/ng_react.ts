//
// This is using ng-react with this PR applied https://github.com/ngReact/ngReact/pull/199
//

// # ngReact
// ### Use React Components inside of your Angular applications
//
// Composed of
// - reactComponent (generic directive for delegating off to React Components)
// - reactDirective (factory for creating specific directives that correspond to reactComponent directives)

import angular, { auto } from 'angular';
import { kebabCase } from 'lodash';
import React, { ComponentType } from 'react';
import { createRoot, Root } from 'react-dom/client';

// get a react component from name (components can be an angular injectable e.g. value, factory or
// available on window
function getReactComponent(
  name: string | Function,
  $injector: auto.IInjectorService
): ComponentType<React.PropsWithChildren<{}>> {
  // if name is a function assume it is component and return it
  if (angular.isFunction(name)) {
    return name as unknown as ComponentType<React.PropsWithChildren<{}>>;
  }

  // a React component name must be specified
  if (!name) {
    throw new Error('ReactComponent name attribute must be specified');
  }

  // ensure the specified React component is accessible, and fail fast if it's not
  let reactComponent;
  try {
    reactComponent = $injector.get(name);
  } catch (e) {}

  if (!reactComponent) {
    try {
      reactComponent = name.split('.').reduce((current, namePart) => {
        // @ts-ignore
        return current[namePart];
      }, window);
    } catch (e) {}
  }

  if (!reactComponent) {
    throw Error('Cannot find react component ' + name);
  }

  return reactComponent as unknown as ComponentType<React.PropsWithChildren<{}>>;
}

// wraps a function with scope.$apply, if already applied just return
function applied(fn: any, scope: any) {
  if (fn.wrappedInApply) {
    return fn;
  }
  // this had the equivalent of `eslint-disable-next-line prefer-arrow/prefer-arrow-functions`
  const wrapped: any = function () {
    const args = arguments;
    const phase = scope.$root.$$phase;
    if (phase === '$apply' || phase === '$digest') {
      return fn.apply(null, args);
    } else {
      return scope.$apply(() => {
        return fn.apply(null, args);
      });
    }
  };
  wrapped.wrappedInApply = true;
  return wrapped;
}

/**
 * wraps functions on obj in scope.$apply
 *
 * keeps backwards compatibility, as if propsConfig is not passed, it will
 * work as before, wrapping all functions and won't wrap only when specified.
 *
 * @version 0.4.1
 * @param obj react component props
 * @param scope current scope
 * @param propsConfig configuration object for all properties
 * @returns {Object} props with the functions wrapped in scope.$apply
 */
function applyFunctions(obj: any, scope: any, propsConfig?: any): object {
  return Object.keys(obj || {}).reduce((prev, key) => {
    const value = obj[key];
    const config = (propsConfig || {})[key] || {};
    /**
     * wrap functions in a function that ensures they are scope.$applied
     * ensures that when function is called from a React component
     * the Angular digest cycle is run
     */
    // @ts-ignore
    prev[key] = angular.isFunction(value) && config.wrapApply !== false ? applied(value, scope) : value;

    return prev;
  }, {});
}

/**
 *
 * @param watchDepth (value of HTML watch-depth attribute)
 * @param scope (angular scope)
 *
 * Uses the watchDepth attribute to determine how to watch props on scope.
 * If watchDepth attribute is NOT reference or collection, watchDepth defaults to deep watching by value
 */
function watchProps(watchDepth: string, scope: any, watchExpressions: any[], listener: any) {
  const supportsWatchCollection = angular.isFunction(scope.$watchCollection);
  const supportsWatchGroup = angular.isFunction(scope.$watchGroup);

  const watchGroupExpressions = [];

  for (const expr of watchExpressions) {
    const actualExpr = getPropExpression(expr);
    const exprWatchDepth = getPropWatchDepth(watchDepth, expr);

    // ignore empty expressions & expressions with functions
    if (!actualExpr || actualExpr.match(/\(.*\)/) || exprWatchDepth === 'one-time') {
      continue;
    }

    if (exprWatchDepth === 'collection' && supportsWatchCollection) {
      scope.$watchCollection(actualExpr, listener);
    } else if (exprWatchDepth === 'reference' && supportsWatchGroup) {
      watchGroupExpressions.push(actualExpr);
    } else {
      scope.$watch(actualExpr, listener, exprWatchDepth !== 'reference');
    }
  }

  if (watchDepth === 'one-time') {
    listener();
  }

  if (watchGroupExpressions.length) {
    scope.$watchGroup(watchGroupExpressions, listener);
  }
}

// render React component, with scope[attrs.props] being passed in as the component props
function renderComponent(component: any, props: object, scope: any, root: Root) {
  scope.$evalAsync(() => {
    root.render(React.createElement(component, props));
  });
}

// get prop name from prop (string or array)
function getPropName(prop: any) {
  return Array.isArray(prop) ? prop[0] : prop;
}

// get prop name from prop (string or array)
function getPropConfig(prop: any) {
  return Array.isArray(prop) ? prop[1] : {};
}

// get prop expression from prop (string or array)
function getPropExpression(prop: any) {
  return Array.isArray(prop) ? prop[0] : prop;
}

/**
 * Finds the normalized attribute knowing that React props accept any type of capitalization and it also handles
 * kabab case attributes which can be used in case the attribute would also be a standard html attribute and would be
 * evaluated by the browser as such.
 * @param attrs All attributes of the component.
 * @param propName Name of the prop that react component expects.
 */
function findAttribute(attrs: object, propName: string): string {
  const index = Object.keys(attrs).find((attr: any) => {
    return attr.toLowerCase() === propName.toLowerCase() || kebabCase(attr) === kebabCase(propName);
  });
  // @ts-ignore
  return attrs[index];
}

// get watch depth of prop (string or array)
function getPropWatchDepth(defaultWatch: string, prop: string | any[]) {
  const customWatchDepth = Array.isArray(prop) && angular.isObject(prop[1]) && prop[1].watchDepth;
  return customWatchDepth || defaultWatch;
}

// # reactComponent
// Directive that allows React components to be used in Angular templates.
//
// Usage:
//     <react-component name="Hello" props="name"/>
//
// This requires that there exists an injectable or globally available 'Hello' React component.
// The 'props' attribute is optional and is passed to the component.
//
// The following would would create and register the component:
//
//     var module = angular.module('ace.react.components');
//     module.value('Hello', React.createClass({
//         render: function() {
//             return <div>Hello {this.props.name}</div>;
//         }
//     }));
//
const reactComponent = ($injector: any): any => {
  return {
    restrict: 'E',
    replace: true,
    link: function (scope: any, elem: Element[], attrs: any) {
      const reactComponent = getReactComponent(attrs.name, $injector);

      const root = createRoot(elem[0]);
      const renderMyComponent = () => {
        const scopeProps = scope.$eval(attrs.props);
        const props = applyFunctions(scopeProps, scope);

        renderComponent(reactComponent, props, scope, root);
      };

      // If there are props, re-render when they change
      attrs.props ? watchProps(attrs.watchDepth, scope, [attrs.props], renderMyComponent) : renderMyComponent();

      // cleanup when scope is destroyed
      scope.$on('$destroy', () => {
        if (!attrs.onScopeDestroy) {
          root.unmount();
        } else {
          scope.$eval(attrs.onScopeDestroy, {
            unmountComponent: root.unmount.bind(this),
          });
        }
      });
    },
  };
};

// # reactDirective
// Factory function to create directives for React components.
//
// With a component like this:
//
//     var module = angular.module('ace.react.components');
//     module.value('Hello', React.createClass({
//         render: function() {
//             return <div>Hello {this.props.name}</div>;
//         }
//     }));
//
// A directive can be created and registered with:
//
//     module.directive('hello', function(reactDirective) {
//         return reactDirective('Hello', ['name']);
//     });
//
// Where the first argument is the injectable or globally accessible name of the React component
// and the second argument is an array of property names to be watched and passed to the React component
// as props.
//
// This directive can then be used like this:
//
//     <hello name="name"/>
//
const reactDirective = ($injector: auto.IInjectorService) => {
  return (reactComponentName: string, props: string[], conf: any, injectableProps: any) => {
    const directive = {
      restrict: 'E',
      replace: true,
      link: function (scope: any, elem: Element[], attrs: any) {
        const reactComponent = getReactComponent(reactComponentName, $injector);
        const root = createRoot(elem[0]);

        // if props is not defined, fall back to use the React component's propTypes if present
        props = props || Object.keys(reactComponent.propTypes || {});

        // for each of the properties, get their scope value and set it to scope.props
        const renderMyComponent = () => {
          let scopeProps: any = {};
          const config: any = {};

          props.forEach((prop) => {
            const propName = getPropName(prop);
            scopeProps[propName] = scope.$eval(findAttribute(attrs, propName));
            config[propName] = getPropConfig(prop);
          });

          scopeProps = applyFunctions(scopeProps, scope, config);
          scopeProps = angular.extend({}, scopeProps, injectableProps);
          renderComponent(reactComponent, scopeProps, scope, root);
        };

        // watch each property name and trigger an update whenever something changes,
        // to update scope.props with new values
        const propExpressions = props.map((prop) => {
          return Array.isArray(prop)
            ? [findAttribute(attrs, prop[0]), getPropConfig(prop)]
            : findAttribute(attrs, prop);
        });

        // If we don't have any props, then our watch statement won't fire.
        props.length ? watchProps(attrs.watchDepth, scope, propExpressions, renderMyComponent) : renderMyComponent();

        // cleanup when scope is destroyed
        scope.$on('$destroy', () => {
          if (!attrs.onScopeDestroy) {
            root.unmount();
          } else {
            scope.$eval(attrs.onScopeDestroy, {
              unmountComponent: root.unmount.bind(this),
            });
          }
        });
      },
    };
    return angular.extend(directive, conf);
  };
};

const ngModule = angular.module('react', []);
ngModule.directive('reactComponent', ['$injector', reactComponent]);
ngModule.factory('reactDirective', ['$injector', reactDirective]);
