import { useEffect, useRef } from 'react';
import { Unsubscribable } from 'rxjs';

import { config, ThemeChangedEvent } from '@grafana/runtime';
import { appEvents } from 'app/core/app_events';
import { contextSrv } from 'app/core/services/context_srv';
import { changeTheme } from 'app/core/services/theme';

export function useSystemThemeWatcher() {
  const mediaQueryListRef = useRef<MediaQueryList>();
  const themeChangedSubRef = useRef<Unsubscribable>();

  useEffect(() => {
    const onSystemThemeChange = (event: MediaQueryListEvent) => {
      if (contextSrv.user.theme === 'system') {
        const newThemeMode = event.matches ? 'dark' : 'light';
        const currentThemeMode = config.theme2.colors.mode;
        if (currentThemeMode !== newThemeMode) {
          changeTheme(newThemeMode, true);
        }
      }
    };

    const setupListener = () => {
      // Teardown first to ensure clean state
      teardownListener();

      // We only attach listener if the USER PREFERENCE is 'system'.
      // If it is 'dark' or 'light', they have overridden the system.
      if (contextSrv.user.theme === 'system') {
        mediaQueryListRef.current = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQueryListRef.current.addEventListener('change', onSystemThemeChange);
      }
    };

    const teardownListener = () => {
      if (mediaQueryListRef.current) {
        mediaQueryListRef.current.removeEventListener('change', onSystemThemeChange);
        mediaQueryListRef.current = undefined;
      }
    };

    setupListener();

    themeChangedSubRef.current = appEvents.subscribe(ThemeChangedEvent, () => {
      setupListener();
    });

    return () => {
      teardownListener();
      themeChangedSubRef.current?.unsubscribe();
    };
  }, []);
}
