import React from 'react';
import config, { Settings } from 'app/core/config';
import { GrafanaTheme } from '@grafana/ui';

export const ConfigContext = React.createContext<Settings>(config);
export const ConfigConsumer = ConfigContext.Consumer;

export const provideConfig = (component: React.ComponentType<any>) => {
  const ConfigProvider = (props: any) => (
    <ConfigContext.Provider value={config}>{React.createElement(component, { ...props })}</ConfigContext.Provider>
  );

  return ConfigProvider;
};

interface ThemeProviderProps {
  children: (theme: GrafanaTheme) => JSX.Element;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  return (
    <ConfigConsumer>
      {({ bootData }) => {
        return children(bootData.user.lightTheme ? GrafanaTheme.Light : GrafanaTheme.Dark);
      }}
    </ConfigConsumer>
  );
};
