import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect } from 'react';

import {
  Theme,
  useGetThemeQuery,
  useGetUserThemeQuery,
  useListThemeQuery,
  useListUserThemeQuery,
} from '@grafana/api-clients/rtkq/theme/v0alpha1';
import { createTheme, registerCustomTheme, isRegisteredTheme } from '@grafana/data';
import { config } from '@grafana/runtime';

import { changeTheme } from '../../core/services/theme';

/**
 * Render-nothing component that fetches all custom themes from the API at app
 * start and registers them into the theme registry so they are available in
 * the theme picker on any page.
 */
export function useRegisterCustomTheme() {
  const configTheme = config.bootData.user.theme;

  const exists = isRegisteredTheme(configTheme);

  const { data } = useGetThemeQuery(
    exists
      ? skipToken
      : {
          name: configTheme,
        }
  );
  const { data: userThemeData } = useGetUserThemeQuery(
    exists
      ? skipToken
      : {
          name: configTheme,
        }
  );

  useEffect(() => {
    if (data) {
      registerTheme(data);
    }
  }, [data]);

  useEffect(() => {
    if (userThemeData) {
      registerTheme(userThemeData, true);
    }
  }, [userThemeData]);

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
