import { __assign } from "tslib";
import { createTheme } from '@grafana/data';
import hoistNonReactStatics from 'hoist-non-react-statics';
import React, { useContext } from 'react';
import { stylesFactory } from './stylesFactory';
/**
 * Mock used in tests
 */
var ThemeContextMock = null;
// Used by useStyles()
export var memoizedStyleCreators = new WeakMap();
// Use Grafana Dark theme by default
/** @public */
export var ThemeContext = React.createContext(createTheme());
ThemeContext.displayName = 'ThemeContext';
/** @deprecated use withTheme2 */
/** @public */
export var withTheme = function (Component) {
    var WithTheme = function (props) {
        /**
         * If theme context is mocked, let's use it instead of the original context
         * This is used in tests when mocking theme using mockThemeContext function defined below
         */
        var ContextComponent = ThemeContextMock || ThemeContext;
        return (
        // @ts-ignore
        React.createElement(ContextComponent.Consumer, null, function (theme) { return React.createElement(Component, __assign({}, props, { theme: theme.v1 })); }));
    };
    WithTheme.displayName = "WithTheme(" + Component.displayName + ")";
    hoistNonReactStatics(WithTheme, Component);
    return WithTheme;
};
/** @alpha */
export var withTheme2 = function (Component) {
    var WithTheme = function (props) {
        /**
         * If theme context is mocked, let's use it instead of the original context
         * This is used in tests when mocking theme using mockThemeContext function defined below
         */
        var ContextComponent = ThemeContextMock || ThemeContext;
        return (
        // @ts-ignore
        React.createElement(ContextComponent.Consumer, null, function (theme) { return React.createElement(Component, __assign({}, props, { theme: theme })); }));
    };
    WithTheme.displayName = "WithTheme(" + Component.displayName + ")";
    hoistNonReactStatics(WithTheme, Component);
    return WithTheme;
};
/** @deprecated use useTheme2 */
/** @public */
export function useTheme() {
    return useContext(ThemeContextMock || ThemeContext).v1;
}
/** @public */
export function useTheme2() {
    return useContext(ThemeContextMock || ThemeContext);
}
/**
 * Hook for using memoized styles with access to the theme.
 *
 * NOTE: For memoization to work, you need to ensure that the function
 * you pass in doesn't change, or only if it needs to. (i.e. declare
 * your style creator outside of a function component or use `useCallback()`.)
 * */
/** @public */
export function useStyles(getStyles) {
    var theme = useTheme();
    var memoizedStyleCreator = memoizedStyleCreators.get(getStyles);
    if (!memoizedStyleCreator) {
        memoizedStyleCreator = stylesFactory(getStyles);
        memoizedStyleCreators.set(getStyles, memoizedStyleCreator);
    }
    return memoizedStyleCreator(theme);
}
/**
 * Hook for using memoized styles with access to the theme.
 *
 * NOTE: For memoization to work, you need to ensure that the function
 * you pass in doesn't change, or only if it needs to. (i.e. declare
 * your style creator outside of a function component or use `useCallback()`.)
 * */
/** @public */
export function useStyles2(getStyles) {
    var theme = useTheme2();
    var memoizedStyleCreator = memoizedStyleCreators.get(getStyles);
    if (!memoizedStyleCreator) {
        memoizedStyleCreator = stylesFactory(getStyles);
        memoizedStyleCreators.set(getStyles, memoizedStyleCreator);
    }
    return memoizedStyleCreator(theme);
}
/**
 * Enables theme context  mocking
 */
/** @public */
export var mockThemeContext = function (theme) {
    ThemeContextMock = React.createContext(theme);
    return function () {
        ThemeContextMock = null;
    };
};
//# sourceMappingURL=ThemeContext.js.map