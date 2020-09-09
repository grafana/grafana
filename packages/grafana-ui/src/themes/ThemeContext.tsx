import { GrafanaTheme, GrafanaThemeType } from '@grafana/data';
import hoistNonReactStatics from 'hoist-non-react-statics';
import React, { useContext, useEffect } from 'react';
import { Themeable } from '../types/theme';
import { getTheme } from './getTheme';
import { stylesFactory } from './stylesFactory';

type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;
type Subtract<T, K> = Omit<T, keyof K>;

/**
 * Mock used in tests
 */
let ThemeContextMock: React.Context<GrafanaTheme> | null = null;

// Used by useStyles()
export const memoizedStyleCreators = new WeakMap();

// Use Grafana Dark theme by default
export const ThemeContext = React.createContext(getTheme(GrafanaThemeType.Dark));
ThemeContext.displayName = 'ThemeContext';

export const withTheme = <P extends Themeable, S extends {} = {}>(Component: React.ComponentType<P>) => {
  const WithTheme: React.FunctionComponent<Subtract<P, Themeable>> = props => {
    /**
     * If theme context is mocked, let's use it instead of the original context
     * This is used in tests when mocking theme using mockThemeContext function defined below
     */
    const ContextComponent = ThemeContextMock || ThemeContext;
    // @ts-ignore
    return <ContextComponent.Consumer>{theme => <Component {...props} theme={theme} />}</ContextComponent.Consumer>;
  };

  WithTheme.displayName = `WithTheme(${Component.displayName})`;
  hoistNonReactStatics(WithTheme, Component);
  type Hoisted = typeof WithTheme & S;
  return WithTheme as Hoisted;
};

export function useTheme(): GrafanaTheme {
  return useContext(ThemeContextMock || ThemeContext);
}

/**
 * Hook for using memoized styles with access to the theme.
 *
 * NOTE: For memoization to work, you need to ensure that the function
 * you pass in doesn't change, or only if it needs to. (i.e. declare
 * your style creator outside of a function component or use `useCallback()`.)
 * */
export function useStyles<T>(getStyles: (theme: GrafanaTheme) => T) {
  const theme = useTheme();

  let memoizedStyleCreator = memoizedStyleCreators.get(getStyles) as typeof getStyles;
  if (!memoizedStyleCreator) {
    memoizedStyleCreator = stylesFactory(getStyles);
    memoizedStyleCreators.set(getStyles, memoizedStyleCreator);
  }

  useEffect(() => {
    return () => {
      memoizedStyleCreators.delete(getStyles);
    };
  }, [getStyles]);

  return memoizedStyleCreator(theme);
}

/**
 * Enables theme context  mocking
 */
export const mockThemeContext = (theme: Partial<GrafanaTheme>) => {
  ThemeContextMock = React.createContext(theme as GrafanaTheme);
  return () => {
    ThemeContextMock = null;
  };
};
