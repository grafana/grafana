import { useEffect, useMemo, useState } from 'react';
import * as React from 'react';
import { SkeletonTheme } from 'react-loading-skeleton';

import { getThemeById, type GrafanaTheme2, ThemeContext } from '@grafana/data';
import { ThemeChangedEvent, config } from '@grafana/runtime';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';

import { appEvents } from '../app_events';
import 'react-loading-skeleton/dist/skeleton.css';

// temporarily remap dark/light to the visual refresh themes if the flag is enabled
// when delivering the visual refresh, remove this remapping and use the updated dark/light themes directly
function maybeRemapTheme(theme: GrafanaTheme2, visualRefreshEnabled: boolean): GrafanaTheme2 {
  if (visualRefreshEnabled) {
    if (theme.name === 'Dark') {
      return getThemeById('visual_refresh_dark');
    } else if (theme.name === 'Light') {
      return getThemeById('visual_refresh_light');
    }
  }
  return theme;
}

export const ThemeProvider = ({ children, value }: { children: React.ReactNode; value: GrafanaTheme2 }) => {
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();

  const [theme, setTheme] = useState(() => maybeRemapTheme(value, visualRefreshEnabled));

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
      const newTheme = maybeRemapTheme(event.payload, visualRefreshEnabled);
      config.theme2 = newTheme;
      setTheme(newTheme);
    });

    return () => sub.unsubscribe();
  }, [visualRefreshEnabled]);

  useEffect(() => {
    setTheme(maybeRemapTheme(value, visualRefreshEnabled));
  }, [value, visualRefreshEnabled]);

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
