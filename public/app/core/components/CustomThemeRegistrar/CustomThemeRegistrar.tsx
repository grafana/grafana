import { useEffect } from 'react';

import { useListThemeQuery } from '@grafana/api-clients/rtkq/theme/v0alpha1';
import { createTheme, registerCustomTheme } from '@grafana/data';

/**
 * Render-nothing component that fetches all custom themes from the API at app
 * start and registers them into the theme registry so they are available in
 * the theme picker on any page.
 */
export function CustomThemeRegistrar() {
  const { data } = useListThemeQuery({});

  useEffect(() => {
    for (const theme of data?.items ?? []) {
      registerCustomTheme({
        id: theme.metadata.name!,
        name: theme.metadata.name!,
        isExtra: true,
        build: () => createTheme(theme.spec),
      });
    }
  }, [data?.items]);

  return null;
}
