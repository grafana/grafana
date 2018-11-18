import client from './client';
import * as setup from './setup';

describe('/api/folders', () => {
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
      folders: [
        {
          title: 'Folder 1',
          uid: 'f-01',
        },
        {
          title: 'Folder 2',
          uid: 'f-02',
        },
        {
          title: 'Folder 3',
          uid: 'f-03',
        },
      ],
    });
  });

  describe('With admin user', () => {
    it('can delete folder', async () => {
      let rsp = await client.callAs(setup.admin).delete(`/api/folders/f-01`);
      expect(rsp.data.title).toBe('Folder 1');
    });

    it('can update folder', async () => {
      let rsp = await client.callAs(setup.admin).put(`/api/folders/f-02`, {
        uid: 'f-02',
        title: 'Folder 2 upd',
        overwrite: true,
      });
      expect(rsp.data.title).toBe('Folder 2 upd');
    });

    it('can update folder uid', async () => {
      let rsp = await client.callAs(setup.admin).put(`/api/folders/f-03`, {
        uid: 'f-03-upd',
        title: 'Folder 3 upd',
        overwrite: true,
      });
      expect(rsp.data.uid).toBe('f-03-upd');
      expect(rsp.data.title).toBe('Folder 3 upd');
    });
  });

  describe('With viewer user', () => {
    it('Cannot delete folder', async () => {
      let rsp = await setup.expectError(() => {
        return client.callAs(setup.viewer).delete(`/api/folders/f-02`);
      });
      expect(rsp.response.status).toBe(403);
    });

    it('Cannot update folder', async () => {
      let rsp = await setup.expectError(() => {
        return client.callAs(setup.viewer).put(`/api/folders/f-02`, {
          uid: 'f-02',
          title: 'Folder 2 upd',
          overwrite: true,
        });
      });
      expect(rsp.response.status).toBe(403);
    });
  });
});
