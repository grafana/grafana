import React, { useContext } from 'react';
import hoistNonReactStatics from 'hoist-non-react-statics';

import { getTheme } from './getTheme';
import { Themeable } from '../types/theme';
import { GrafanaTheme, GrafanaThemeType } from '@grafana/data';

type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;
type Subtract<T, K> = Omit<T, keyof K>;

/**
 * Mock used in tests
 */
let ThemeContextMock: React.Context<GrafanaTheme> | null = null;

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

export function useTheme() {
  return useContext(ThemeContextMock || ThemeContext);
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
