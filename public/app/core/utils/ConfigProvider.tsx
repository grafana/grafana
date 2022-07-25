import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { ThemeChangedEvent } from '@grafana/runtime';
import { ThemeContext } from '@grafana/ui';

import { appEvents } from '../core';

export const ThemeProvider = ({ children, value }: { children: React.ReactNode; value: GrafanaTheme2 }) => {
  const [theme, setTheme] = useState(value);

  useEffect(() => {
    const sub = appEvents.subscribe(ThemeChangedEvent, (event) => {
      setTheme(event.payload);
    });

    return () => sub.unsubscribe();
  }, []);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};

export const provideTheme = (component: React.ComponentType<any>, theme: GrafanaTheme2) => {
  return function ThemeProviderWrapper(props: any) {
    return <ThemeProvider value={theme}>{React.createElement(component, { ...props })}</ThemeProvider>;
  };
};
