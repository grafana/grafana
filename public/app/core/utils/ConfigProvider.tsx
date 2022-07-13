import React, { useEffect, useState } from 'react';

import { createTheme } from '@grafana/data';
import { config, ThemeChangedEvent } from '@grafana/runtime';
import { ThemeContext } from '@grafana/ui';

import { appEvents } from '../core';

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState(getCurrentUserTheme());

  useEffect(() => {
    const sub = appEvents.subscribe(ThemeChangedEvent, (event) => {
      setTheme(event.payload);
    });

    return () => sub.unsubscribe();
  }, []);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};

function getCurrentUserTheme() {
  return createTheme({
    colors: {
      mode: config.bootData.user.lightTheme ? 'light' : 'dark',
    },
  });
}

export const provideTheme = (component: React.ComponentType<any>) => {
  return function ThemeProviderWrapper(props: any) {
    return <ThemeProvider>{React.createElement(component, { ...props })}</ThemeProvider>;
  };
};
