import { useEffect } from 'react';

import { useListThemeQuery } from '@grafana/api-clients/rtkq/theme/v0alpha1';
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

  useEffect(() => {
    // If the user's preferred theme is a custom theme, it wasn't available in
    // the registry at boot time so the app fell back to the default. Now that
    // custom themes are registered, apply the correct one.
    const userTheme = config.bootData.user.theme;

    for (const theme of data?.items ?? []) {
      registerCustomTheme({
        id: theme.metadata.name!,
        name: theme.metadata.name!,
        isExtra: true,
        build: () => createTheme(theme.spec),
      });

      // If the user's preferred theme is a custom theme, it wasn't available in
      // the registry at boot time so the app fell back to the default. Now that
      // custom themes are registered, apply the correct one.
      if (theme.metadata.name === userTheme) {
        changeTheme(userTheme, true);
      }
    }
  }, [data?.items]);

  return null;
}
