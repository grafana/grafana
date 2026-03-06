import { useListThemeQuery } from '@grafana/api-clients/rtkq/theme/v0alpha1';
import { createTheme, getBuiltInThemes, registerCustomTheme } from '@grafana/data';
import { t } from '@grafana/i18n';

import { isUserTheme } from './userThemeUtils';

export const validateGcomTheme = (gcomThemeID: string) => {
  const match = /(^\d+$)|themes\/(\d+)/.exec(gcomThemeID);

  return match && (match[1] || match[2])
    ? true
    : t('admin.new-custom-theme-page.validation.invalid-theme-id', 'Could not find a valid Grafana.com theme ID');
};

export const fetchGcomTheme = async (themeId: string) => {
  try {
    // const response = await getBackendSrv().get(`/api/gnet/themes/${themeId}`);
    // TODO remove this hardcoded fetch
    const response = await fetch(
      'https://gist.githubusercontent.com/ashharrison90/546392c47a87373e17f3040fd4fc5c89/raw/catppuccin-mocha.json'
    );
    const json = response.json();
    return json;
  } catch (error) {
    // TODO do something with error
  }
};

export function getSelectableThemes() {
  return getBuiltInThemes();
}

export function useSelectableThemes(type: 'org' | 'team' | 'user' = 'user') {
  const { data } = useListThemeQuery({});

  for (const theme of data?.items ?? []) {
    const isUser = isUserTheme(theme.metadata.labels);

    // For org/team pickers, skip user themes
    if (type !== 'user' && isUser) {
      continue;
    }

    registerCustomTheme({
      id: theme.metadata.name!,
      name: theme.spec.name,
      isExtra: true,
      isUser,
      build: () => createTheme(theme.spec),
    });
  }

  return getBuiltInThemes();
}
