import { HttpResponse, http } from 'msw';

import { wellFormedTree } from '../../../fixtures/folders';
import { mockStarredDashboardsMap } from '../../../fixtures/starred';
import { MOCK_TEAMS } from '../../../fixtures/teams';
const [_, { dashbdD }] = wellFormedTree();

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
    return HttpResponse.json({
      homeDashboardUID: dashbdD.item.uid,
      theme: 'light',
      timezone: 'browser',
      weekStart: 'monday',
      queryHistory: {
        homeTab: '',
      },
      language: '',
    });
  });

const updatePreferencesHandler = () =>
  http.put('/api/user/preferences', async () => {
    return HttpResponse.json({ message: 'Preferences updated' });
  });

const getSignedInUserTeamListHandler = () =>
  // For now, current user is member of all mock fixture teams
  http.get('/api/user/teams', async () => {
    return HttpResponse.json(
      MOCK_TEAMS.map((team) => ({
        id: Number(team.metadata.labels['grafana.app/deprecatedInternalID']),
        uid: team.metadata.name,
        name: team.spec.title,
        email: team.spec.email,
        orgId: 1,
        isProvisioned: false,
        memberCount: 0,
        permission: 0,
        avatarUrl: '',
      }))
    );
  });

const handlers = [
  getPreferencesHandler(),
  updatePreferencesHandler(),
  getStarsHandler(),
  deleteDashboardStarHandler(),
  addDashboardStarHandler(),
  getSignedInUserTeamListHandler(),
];

export default handlers;
