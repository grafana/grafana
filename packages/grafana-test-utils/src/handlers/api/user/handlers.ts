import { HttpResponse, http, type HttpResponseResolver } from 'msw';

import { type PreferencesSpec } from '@grafana/api-clients/rtkq/preferences/v1alpha1';

import { mockUserPreferences, setMockUserPreferences } from '../../../fixtures/preferences';
import { mockStarredDashboardsMap } from '../../../fixtures/starred';

const getStarsHandler = () =>
  http.get('/api/user/stars', async () => {
    return HttpResponse.json(Array.from(mockStarredDashboardsMap.keys()));
  });

const deleteDashboardStarHandler = () =>
  http.delete<{ uid: string }>('/api/user/stars/dashboard/uid/:uid', async ({ params }) => {
    const { uid } = params;
    mockStarredDashboardsMap.delete(uid);
    return HttpResponse.json({ message: 'Dashboard unstarred' });
  });

const addDashboardStarHandler = () =>
  http.post<{ uid: string }>('/api/user/stars/dashboard/uid/:uid', async ({ params }) => {
    const { uid } = params;
    mockStarredDashboardsMap.set(uid, true);
    return HttpResponse.json({ message: 'Dashboard starred!' });
  });

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

// Override the GET in a test — e.g. to simulate a pending/slow or failing request.
export const customGetUserPreferencesHandler = (resolver: HttpResponseResolver) =>
  http.get('/api/user/preferences', resolver);

// Override the PATCH in a test — e.g. to simulate a pending/slow save or a failing request.
export const customPatchUserPreferencesHandler = (resolver: HttpResponseResolver) =>
  http.patch('/api/user/preferences', resolver);

const getSignedInUserTeamListHandler = () =>
  http.get('/api/user/teams', async () => {
    return HttpResponse.json([]);
  });

const handlers = [
  getPreferencesHandler(),
  updatePreferencesHandler(),
  patchPreferencesHandler(),
  getStarsHandler(),
  deleteDashboardStarHandler(),
  addDashboardStarHandler(),
  getSignedInUserTeamListHandler(),
];

export default handlers;
