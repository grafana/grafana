import React, { useContext } from 'react';
import hoistNonReactStatics from 'hoist-non-react-statics';

import { getTheme } from './getTheme';
import { GrafanaThemeType, Themeable } from '../types/theme';

type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;
type Subtract<T, K> = Omit<T, keyof K>;

// Use Grafana Dark theme by default
export const ThemeContext = React.createContext(getTheme(GrafanaThemeType.Dark));

export const withTheme = <P extends Themeable, S extends {} = {}>(Component: React.ComponentType<P>) => {
  const WithTheme: React.FunctionComponent<Subtract<P, Themeable>> = props => {
    // @ts-ignore
    return <ThemeContext.Consumer>{theme => <Component {...props} theme={theme} />}</ThemeContext.Consumer>;
  };

  WithTheme.displayName = `WithTheme(${Component.displayName})`;
  hoistNonReactStatics(WithTheme, Component);
  type Hoisted = typeof WithTheme & S;
  return WithTheme as Hoisted;
};

export function useTheme() {
  return useContext(ThemeContext);
}
