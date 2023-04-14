import hoistNonReactStatics from 'hoist-non-react-statics';
import React, { useContext } from 'react';

import { createTheme, GrafanaTheme, GrafanaTheme2 } from '@grafana/data';

import { Themeable, Themeable2 } from '../types/theme';

import { stylesFactory } from './stylesFactory';

type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;
type Subtract<T, K> = Omit<T, keyof K>;

/**
 * Mock used in tests
 */
let ThemeContextMock: React.Context<GrafanaTheme2> | null = null;

// Used by useStyles()
export const memoizedStyleCreators = new WeakMap();

// Use Grafana Dark theme by default
/** @public */
export const ThemeContext = React.createContext(createTheme());

ThemeContext.displayName = 'ThemeContext';

/** @deprecated use withTheme2 */
/** @public */
export const withTheme = <P extends Themeable, S extends {} = {}>(Component: React.ComponentType<P>) => {
  const WithTheme: React.FunctionComponent<Subtract<P, Themeable>> = (props) => {
    /**
     * If theme context is mocked, let's use it instead of the original context
     * This is used in tests when mocking theme using mockThemeContext function defined below
     */
    const ContextComponent = ThemeContextMock || ThemeContext;
    return (
      // @ts-ignore
      <ContextComponent.Consumer>{(theme) => <Component {...props} theme={theme.v1} />}</ContextComponent.Consumer>
    );
  };

  WithTheme.displayName = `WithTheme(${Component.displayName})`;
  hoistNonReactStatics(WithTheme, Component);
  type Hoisted = typeof WithTheme & S;
  return WithTheme as Hoisted;
};

/** @alpha */
export const withTheme2 = <P extends Themeable2, S extends {} = {}>(Component: React.ComponentType<P>) => {
  const WithTheme: React.FunctionComponent<Subtract<P, Themeable2>> = (props) => {
    /**
     * If theme context is mocked, let's use it instead of the original context
     * This is used in tests when mocking theme using mockThemeContext function defined below
     */
    const ContextComponent = ThemeContextMock || ThemeContext;
    return (
      // @ts-ignore
      <ContextComponent.Consumer>{(theme) => <Component {...props} theme={theme} />}</ContextComponent.Consumer>
    );
  };

  WithTheme.displayName = `WithTheme(${Component.displayName})`;
  hoistNonReactStatics(WithTheme, Component);
  type Hoisted = typeof WithTheme & S;
  return WithTheme as Hoisted;
};

/** @deprecated use useTheme2 */
/** @public */
export function useTheme(): GrafanaTheme {
  return useContext(ThemeContextMock || ThemeContext).v1;
}

/** @public */
export function useTheme2(): GrafanaTheme2 {
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
export function useStyles<T>(getStyles: (theme: GrafanaTheme) => T) {
  const theme = useTheme();

  let memoizedStyleCreator = memoizedStyleCreators.get(getStyles) as typeof getStyles;
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
export function useStyles2<T>(getStyles: (theme: GrafanaTheme2) => T) {
  const theme = useTheme2();

  let memoizedStyleCreator = memoizedStyleCreators.get(getStyles) as typeof getStyles;
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
export const mockThemeContext = (theme: Partial<GrafanaTheme2>) => {
  ThemeContextMock = React.createContext(theme as GrafanaTheme2);

  return () => {
    ThemeContextMock = null;
  };
};
