import client from './client';
import * as setup from './setup';

describe('GET /api/search', () => {
  const state = {};

  beforeAll(async () => {
    state = await setup.ensureState({
      orgName: 'api-test-org',
      users: [{ user: setup.admin, role: 'Admin' }],
      admin: setup.admin,
      dashboards: [
        {
          title: 'Dashboard in root no permissions',
          uid: 'AAA',
        },
      ],
    });
  });

  describe('With admin user', () => {
    it('should return all dashboards', async () => {
      let rsp = await client.callAs(state.admin).get('/api/search');
      expect(rsp.data).toHaveLength(1);
    });
  });
});
