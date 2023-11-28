import hoistNonReactStatics from 'hoist-non-react-statics';
import memoize from 'micro-memoize';
import React, { useContext } from 'react';
import { ThemeContext } from '@grafana/data';
import { stylesFactory } from './stylesFactory';
/**
 * Mock used in tests
 */
let ThemeContextMock = null;
// Used by useStyles()
export const memoizedStyleCreators = new WeakMap();
/** @deprecated use withTheme2 */
/** @public */
export const withTheme = (Component) => {
    const WithTheme = (props) => {
        /**
         * If theme context is mocked, let's use it instead of the original context
         * This is used in tests when mocking theme using mockThemeContext function defined below
         */
        const ContextComponent = ThemeContextMock || ThemeContext;
        return (
        // @ts-ignore
        React.createElement(ContextComponent.Consumer, null, (theme) => React.createElement(Component, Object.assign({}, props, { theme: theme.v1 }))));
    };
    WithTheme.displayName = `WithTheme(${Component.displayName})`;
    hoistNonReactStatics(WithTheme, Component);
    return WithTheme;
};
/** @alpha */
export const withTheme2 = (Component) => {
    const WithTheme = (props) => {
        /**
         * If theme context is mocked, let's use it instead of the original context
         * This is used in tests when mocking theme using mockThemeContext function defined below
         */
        const ContextComponent = ThemeContextMock || ThemeContext;
        return (
        // @ts-ignore
        React.createElement(ContextComponent.Consumer, null, (theme) => React.createElement(Component, Object.assign({}, props, { theme: theme }))));
    };
    WithTheme.displayName = `WithTheme(${Component.displayName})`;
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
/** @deprecated use useStyles2 */
/** @public */
export function useStyles(getStyles) {
    const theme = useTheme();
    let memoizedStyleCreator = memoizedStyleCreators.get(getStyles);
    if (!memoizedStyleCreator) {
        memoizedStyleCreator = stylesFactory(getStyles);
        memoizedStyleCreators.set(getStyles, memoizedStyleCreator);
    }
    return memoizedStyleCreator(theme);
}
/**
 * Hook for using memoized styles with access to the theme. Pass additional
 * arguments to the getStyles function as additional arguments to this hook.
 *
 * Prefer using primitive values (boolean, number, string, etc) for
 * additional arguments for better performance
 *
 * ```
 * const getStyles = (theme, isDisabled, isOdd) => {css(...)}
 * [...]
 * const styles = useStyles2(getStyles, true, Boolean(index % 2))
 * ```
 *
 * NOTE: For memoization to work, ensure that all arguments don't change
 * across renders (or only change if they need to)
 *
 * @public
 * */
export function useStyles2(getStyles, ...additionalArguments) {
    const theme = useTheme2();
    let memoizedStyleCreator = memoizedStyleCreators.get(getStyles);
    if (!memoizedStyleCreator) {
        memoizedStyleCreator = memoize(getStyles, { maxSize: 10 }); // each getStyles function will memoize 10 different sets of props
        memoizedStyleCreators.set(getStyles, memoizedStyleCreator);
    }
    return memoizedStyleCreator(theme, ...additionalArguments);
}
/**
 * Enables theme context mocking
 */
/** @public */
export const mockThemeContext = (theme) => {
    ThemeContextMock = React.createContext(theme);
    return () => {
        ThemeContextMock = null;
    };
};
//# sourceMappingURL=ThemeContext.js.map