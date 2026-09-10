import { HttpResponse, http } from 'msw';

import { type PreferencesSpec } from '@grafana/api-clients/rtkq/preferences/v1';

import { mockUserPreferences, setMockUserPreferences } from '../../../fixtures/preferences';

const getPreferencesHandler = () =>
  http.get('/api/user/preferences', async () => {
    return HttpResponse.json(mockUserPreferences);
  });

const updatePreferencesHandler = () =>
  http.put('/api/user/preferences', async () => {
    return HttpResponse.json({ message: 'Preferences updated' });
  });

const patchPreferencesHandler = () =>
  http.patch('/api/user/preferences', async ({ request }) => {
    // Merge the patch into the stored preferences so a subsequent GET reflects it. The patch
    // command sends the whole `navbar` object, so a shallow merge replaces it correctly.
    const patch = (await request.json()) as Partial<PreferencesSpec>;
    setMockUserPreferences(patch);
    return HttpResponse.json({ message: 'Preferences updated' });
  });

export const getSignedInUserTeamListHandler = (teams: Array<{ uid: string; name: string }> = []) =>
  http.get('/api/user/teams', async () => {
    return HttpResponse.json(teams);
  });

const handlers = [
  getPreferencesHandler(),
  updatePreferencesHandler(),
  patchPreferencesHandler(),
  getSignedInUserTeamListHandler(),
];

export default handlers;
