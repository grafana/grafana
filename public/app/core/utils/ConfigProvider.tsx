import { useEffect, useState } from 'react';
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
  let remappedTheme = theme;

  if (visualRefreshEnabled) {
    if (theme.name === 'Dark') {
      remappedTheme = getThemeById('visual_refresh_dark');
    } else if (theme.name === 'Light') {
      remappedTheme = getThemeById('visual_refresh_light');
    }
  } else {
    if (theme.name === 'Visual Refresh (Dark)') {
      remappedTheme = getThemeById('dark');
    } else if (theme.name === 'Visual Refresh (Light)') {
      remappedTheme = getThemeById('light');
    }
  }

  return {
    ...remappedTheme,
    flags: {
      ...remappedTheme.flags,
      visualDesignRefresh: visualRefreshEnabled,
    },
  };
}

export const ThemeProvider = ({ children, value }: { children: React.ReactNode; value: GrafanaTheme2 }) => {
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();

  const [theme, setTheme] = useState(() => maybeRemapTheme(value, visualRefreshEnabled));

  config.theme2 = theme;

  useEffect(() => {
    const sub = appEvents.subscribe(ThemeChangedEvent, (event) => {
      const newTheme = maybeRemapTheme(event.payload, visualRefreshEnabled);
      setTheme(newTheme);
    });

    return () => sub.unsubscribe();
  }, [visualRefreshEnabled]);

  useEffect(() => {
    setTheme(maybeRemapTheme(value, visualRefreshEnabled));
  }, [value, visualRefreshEnabled]);

  return (
    <ThemeContext.Provider value={theme}>
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
