import { useEffect, useState } from 'react';
import * as React from 'react';
import { SkeletonTheme } from 'react-loading-skeleton';

import { getThemeById, type GrafanaTheme2, ThemeContext } from '@grafana/data';
import { ThemeChangedEvent, config } from '@grafana/runtime';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';

import { appEvents } from '../app_events';
import 'react-loading-skeleton/dist/skeleton.css';
import { useButtonAlertColorMode, type ButtonAlertColorMode } from '../hooks/useButtonAlertColorMode';
import { contextSrv } from '../services/context_srv';

// temporarily remap dark/light to the visual refresh themes if the flag is enabled
// when delivering the visual refresh, remove this remapping and use the updated dark/light themes directly
function maybeRemapTheme(
  theme: GrafanaTheme2,
  visualRefreshEnabled: boolean,
  buttonAlertColorMode: ButtonAlertColorMode
): GrafanaTheme2 {
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

  const sameButtonAlertColors = buttonAlertColorMode === 'same';
  const outlineMatchesAlertStyle = buttonAlertColorMode === 'subtleAlertAndOutline';

  // returning the same reference when nothing changed lets React bail out of re-rendering
  // the whole theme tree every time AppWrapper passes config.theme2 back in as the value prop
  if (
    remappedTheme.flags.visualDesignRefresh === visualRefreshEnabled &&
    remappedTheme.flags.sameButtonAlertColors === sameButtonAlertColors &&
    remappedTheme.flags.outlineMatchesAlertStyle === outlineMatchesAlertStyle
  ) {
    return remappedTheme;
  }

  return {
    ...remappedTheme,
    flags: {
      ...remappedTheme.flags,
      visualDesignRefresh: visualRefreshEnabled,
      sameButtonAlertColors,
      outlineMatchesAlertStyle,
    },
  };
}

export const ThemeProvider = ({ children, value }: { children: React.ReactNode; value: GrafanaTheme2 }) => {
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
  const [buttonAlertColorMode] = useButtonAlertColorMode();

  const [theme, setTheme] = useState(() => maybeRemapTheme(value, visualRefreshEnabled, buttonAlertColorMode));

  config.theme2 = theme;

  useEffect(() => {
    const sub = appEvents.subscribe(ThemeChangedEvent, (event) => {
      const newTheme = maybeRemapTheme(event.payload, visualRefreshEnabled, buttonAlertColorMode);
      setTheme(newTheme);
    });

    return () => sub.unsubscribe();
  }, [visualRefreshEnabled, buttonAlertColorMode]);

  useEffect(() => {
    if (contextSrv.user.theme !== 'system') {
      return;
    }
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setTheme(maybeRemapTheme(getThemeById(e.matches ? 'dark' : 'light'), visualRefreshEnabled, buttonAlertColorMode));
    };
    query.addEventListener('change', handler);

    return () => query.removeEventListener('change', handler);
  }, [visualRefreshEnabled, buttonAlertColorMode]);

  useEffect(() => {
    setTheme(maybeRemapTheme(value, visualRefreshEnabled, buttonAlertColorMode));
  }, [value, visualRefreshEnabled, buttonAlertColorMode]);

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
