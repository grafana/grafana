import { useEffect } from 'react';

import { Theme, useListThemeQuery, useListUserThemeQuery } from '@grafana/api-clients/rtkq/theme/v0alpha1';
import { createTheme, registerCustomTheme } from '@grafana/data';
import { config } from '@grafana/runtime';

import { changeTheme } from '../../services/theme';

/**
 * Render-nothing component that fetches all custom themes from the API at app
 * start and registers them into the theme registry so they are available in
 * the theme picker on any page.
 */
export function CustomThemeRegistrar() {
  const { data } = useListThemeQuery({});
  const { data: userThemeData } = useListUserThemeQuery({});

  useEffect(() => {
    for (const theme of data?.items ?? []) {
      registerTheme(theme);
    }
  }, [data?.items]);

  useEffect(() => {
    for (const theme of userThemeData?.items ?? []) {
      registerTheme(theme, true);
    }
  }, [userThemeData?.items]);

  return null;
}

function registerTheme(theme: Theme, isUserTheme?: boolean) {
  const configTheme = config.bootData.user.theme;

  registerCustomTheme({
    id: theme.metadata.name!,
    name: theme.spec.name,
    isExtra: true,
    isUser: isUserTheme,
    build: () => createTheme(theme.spec),
  });

  // If the user's preferred theme is a custom theme, it wasn't available in
  // the registry at boot time so the app fell back to the default. Now that
  // custom themes are registered, apply the correct one.
  if (theme.metadata.name === configTheme) {
    changeTheme(configTheme, true);
  }
}
