import { Preferences as UserPreferencesDTO } from '@grafana/schema/src/raw/preferences/x/preferences_types.gen';

import { e2e } from '..';
import { fromBaseUrl } from '../support/url';

const defaultUserPreferences = {
  timezone: '', // "Default" option
} as const; // TODO: when we update typescript >4.9 change to `as const satisfies UserPreferencesDTO`

// Only accept preferences we have defaults for as arguments. To allow a new preference to be set, add a default for it
type UserPreferences = Pick<UserPreferencesDTO, keyof typeof defaultUserPreferences>;

export function setUserPreferences(prefs: UserPreferences) {
  e2e.setScenarioContext({ hasChangedUserPreferences: prefs !== defaultUserPreferences });

  return cy.request({
    method: 'PUT',
    url: fromBaseUrl('/api/user/preferences'),
    body: prefs,
  });
}

export function setDefaultUserPreferences() {
  return setUserPreferences(defaultUserPreferences);
}
