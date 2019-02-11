import React from 'react';
import config, { Settings } from 'app/core/config';
import { GrafanaThemeType, ThemeContext, getTheme } from '@grafana/ui';

export const ConfigContext = React.createContext<Settings>(config);
export const ConfigConsumer = ConfigContext.Consumer;

export const provideConfig = (component: React.ComponentType<any>) => {
  const ConfigProvider = (props: any) => (
    <ConfigContext.Provider value={config}>{React.createElement(component, { ...props })}</ConfigContext.Provider>
  );

  return ConfigProvider;
};

export const getCurrentThemeName = () =>
  config.bootData.user.lightTheme ? GrafanaThemeType.Light : GrafanaThemeType.Dark;
export const getCurrentTheme = () => getTheme(getCurrentThemeName());

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <ConfigConsumer>
      {config => {
        return <ThemeContext.Provider value={getCurrentTheme()}>{children}</ThemeContext.Provider>;
      }}
    </ConfigConsumer>
  );
};

export const provideTheme = (component: React.ComponentType<any>) => {
  return provideConfig((props: any) => <ThemeProvider>{React.createElement(component, { ...props })}</ThemeProvider>);
};
