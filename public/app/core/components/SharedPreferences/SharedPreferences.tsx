import { useFlagGrafanaNewPreferencesPage } from '@grafana/runtime/internal';

import { useSelectableThemes } from '../ThemeSelector/useSelectableThemes';

import { SharedPreferencesFunctional } from './SharedPreferencesFunctional';
import SharedPreferencesOld from './SharedPreferencesOld';
import { type Props } from './utils';

export const SharedPreferences = (props: Props) => {
  const newPrefsEnabled = useFlagGrafanaNewPreferencesPage();
  const themes = useSelectableThemes();
  return newPrefsEnabled ? (
    <SharedPreferencesFunctional {...props} />
  ) : (
    <SharedPreferencesOld {...props} themes={themes} />
  );
};

SharedPreferences.displayName = 'SharedPreferences';
