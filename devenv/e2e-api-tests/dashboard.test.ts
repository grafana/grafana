import client from './client';
import * as setup from './setup';

describe('/api/dashboards', () => {
  let state: any = {};

  beforeAll(async () => {
    state = await setup.ensureState({
      orgName: 'api-test-org',
      users: [
        { user: setup.admin, role: 'Admin' },
        { user: setup.editor, role: 'Editor' },
        { user: setup.viewer, role: 'Viewer' },
      ],
      admin: setup.admin,
      dashboards: [
        {
          title: 'aaa',
          uid: 'aaa',
        },
        {
          title: 'bbb',
          uid: 'bbb',
        },
      ],
    });
  });

  describe('With admin user', () => {
    it('can delete dashboard', async () => {
      let rsp = await client.callAs(setup.admin).delete(`/api/dashboards/uid/aaa`);
      expect(rsp.data.title).toBe('aaa');
    });
  });

  describe('With viewer user', () => {
    it('Cannot delete dashboard', async () => {
      let rsp = await setup.expectError(() => {
        return client.callAs(setup.viewer).delete(`/api/dashboards/uid/bbb`);
      });

      expect(rsp.response.status).toBe(403);
    });
  });
});
