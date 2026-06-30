import { useEffect, useMemo, useState } from 'react';
import * as React from 'react';
import { SkeletonTheme } from 'react-loading-skeleton';

import { type GrafanaTheme2, ThemeContext } from '@grafana/data';
import { ThemeChangedEvent, config } from '@grafana/runtime';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';

import { appEvents } from '../app_events';

import 'react-loading-skeleton/dist/skeleton.css';

export const ThemeProvider = ({ children, value }: { children: React.ReactNode; value: GrafanaTheme2 }) => {
  const [theme, setTheme] = useState(value);
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();

  const themeWithFlags = useMemo(
    () => ({
      ...theme,
      flags: {
        ...theme.flags,
        visualDesignRefresh: visualRefreshEnabled,
      },
    }),
    [theme, visualRefreshEnabled]
  );

  useEffect(() => {
    const sub = appEvents.subscribe(ThemeChangedEvent, (event) => {
      config.theme2 = event.payload;
      setTheme(event.payload);
    });

    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    setTheme(value);
  }, [value]);

  return (
    <ThemeContext.Provider value={themeWithFlags}>
      <SkeletonTheme
        baseColor={theme.colors.emphasize(theme.colors.background.secondary)}
        highlightColor={theme.colors.emphasize(theme.colors.background.secondary, 0.1)}
        borderRadius={theme.shape.radius.default}
      >
        {children}
      </SkeletonTheme>
    </ThemeContext.Provider>
  );
};
