import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config, GrafanaBootConfig, ThemeChangedEvent } from '@grafana/runtime';
import { ThemeContext } from '@grafana/ui';

import { appEvents } from '../core';

export const ConfigContext = React.createContext<GrafanaBootConfig>(config);
export const ConfigConsumer = ConfigContext.Consumer;

export const provideConfig = (component: React.ComponentType<any>) => {
  const ConfigProvider = (props: any) => (
    <ConfigContext.Provider value={config}>{React.createElement(component, { ...props })}</ConfigContext.Provider>
  );
  return ConfigProvider;
};

export const ThemeProvider = ({ children, value }: { children: React.ReactNode; value: GrafanaTheme2 }) => {
  const [theme, setTheme] = useState(value);

  useEffect(() => {
    const sub = appEvents.subscribe(ThemeChangedEvent, (event) => {
      //config.theme = event.payload;
      setTheme(event.payload);
    });

    return () => sub.unsubscribe();
  }, []);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};

export const provideTheme = (component: React.ComponentType<any>, theme: GrafanaTheme2) => {
  return provideConfig((props: any) => (
    <ThemeProvider value={theme}>{React.createElement(component, { ...props })}</ThemeProvider>
  ));
};
