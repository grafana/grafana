import React, { useEffect, useState } from 'react';
import { SkeletonTheme } from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { ThemeChangedEvent, config } from '@grafana/runtime';
import { ThemeContext } from '@grafana/ui';

import { appEvents } from '../core';

import 'react-loading-skeleton/dist/skeleton.css';

export const ThemeProvider = ({ children, value }: { children: React.ReactNode; value: GrafanaTheme2 }) => {
  const [theme, setTheme] = useState(value);

  useEffect(() => {
    const sub = appEvents.subscribe(ThemeChangedEvent, (event) => {
      config.theme2 = event.payload;
      setTheme(event.payload);
    });

    return () => sub.unsubscribe();
  }, []);

  return (
    <ThemeContext.Provider value={theme}>
      <SkeletonTheme
        baseColor={theme.colors.background.secondary}
        highlightColor={theme.colors.emphasize(theme.colors.background.secondary)}
        borderRadius={theme.shape.borderRadius()}
      >
        {children}
      </SkeletonTheme>
    </ThemeContext.Provider>
  );
};

export const provideTheme = (component: React.ComponentType<any>, theme: GrafanaTheme2) => {
  return function ThemeProviderWrapper(props: any) {
    return <ThemeProvider value={theme}>{React.createElement(component, { ...props })}</ThemeProvider>;
  };
};
