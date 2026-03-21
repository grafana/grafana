import { useBooleanFlagValue } from '@openfeature/react-sdk';

import { SharedPreferencesFunctional } from './SharedPreferencesFunctional';
import SharedPreferencesOld from './SharedPreferencesOld';
import { Props } from './utils';

export const SharedPreferences = (props: Props) => {
  const newPrefsEnabled = useBooleanFlagValue('functionalSharedPreferences', false);
  return newPrefsEnabled ? <SharedPreferencesFunctional {...props} /> : <SharedPreferencesOld {...props} />;
};

SharedPreferences.displayName = 'SharedPreferences';
