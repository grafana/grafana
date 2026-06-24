import { useFlagGrafanaNewPreferencesPage } from '@grafana/runtime/internal';

import { SharedPreferencesFunctional } from './SharedPreferencesFunctional';
import SharedPreferencesOld from './SharedPreferencesOld';
import { type Props } from './utils';

export const SharedPreferences = (props: Props) => {
  const newPrefsEnabled = useFlagGrafanaNewPreferencesPage();
  return newPrefsEnabled ? <SharedPreferencesFunctional {...props} /> : <SharedPreferencesOld {...props} />;
};

SharedPreferences.displayName = 'SharedPreferences';
