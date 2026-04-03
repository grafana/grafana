import { useBooleanFlagValue } from '@openfeature/react-sdk';

import { SharedPreferencesFunctional } from './SharedPreferencesFunctional';
import SharedPreferencesOld from './SharedPreferencesOld';
import { type Props } from './utils';

export const SharedPreferences = (props: Props) => {
  const newPrefsEnabled = useBooleanFlagValue('grafana.newPreferencesPage', false);
  return newPrefsEnabled ? <SharedPreferencesFunctional {...props} /> : <SharedPreferencesOld {...props} />;
};

SharedPreferences.displayName = 'SharedPreferences';
