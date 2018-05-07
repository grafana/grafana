import { PermissionsStore } from './PermissionsStore';
import { backendSrv } from 'test/mocks/common';

describe('PermissionsStore', () => {
  let store;

  beforeEach(async () => {
    backendSrv.get.mockReturnValue(
      Promise.resolve([
        { id: 2, dashboardId: 1, role: 'Viewer', permission: 1, permissionName: 'View' },
        { id: 3, dashboardId: 1, role: 'Editor', permission: 1, permissionName: 'Edit' },
        {
          id: 4,
          dashboardId: 10,
          permission: 1,
          permissionName: 'View',
          teamId: 1,
          team: 'MyTestTeam',
          inherited: true,
        },
        {
          id: 5,
          dashboardId: 1,
          permission: 1,
          permissionName: 'View',
          userId: 1,
          userLogin: 'MyTestUser',
        },
        {
          id: 6,
          dashboardId: 1,
          permission: 1,
          permissionName: 'Edit',
          teamId: 2,
          team: 'MyTestTeam2',
        },
      ])
    );

    backendSrv.post = jest.fn(() => Promise.resolve({}));

    store = PermissionsStore.create(
      {
        fetching: false,
        items: [],
      },
      {
        backendSrv: backendSrv,
      }
    );

    await store.load(1, false, false);
  });

  it('should save update on permission change', async () => {
    expect(store.items[0].permission).toBe(1);
    expect(store.items[0].permissionName).toBe('View');

    await store.updatePermissionOnIndex(0, 2, 'Edit');

    expect(store.items[0].permission).toBe(2);
    expect(store.items[0].permissionName).toBe('Edit');
    expect(backendSrv.post.mock.calls.length).toBe(1);
    expect(backendSrv.post.mock.calls[0][0]).toBe('/api/dashboards/id/1/permissions');
  });

  it('should save removed permissions automatically', async () => {
    expect(store.items.length).toBe(5);

    await store.removeStoreItem(2);

    expect(store.items.length).toBe(4);
    expect(backendSrv.post.mock.calls.length).toBe(1);
    expect(backendSrv.post.mock.calls[0][0]).toBe('/api/dashboards/id/1/permissions');
  });

  it('should be sorted by sort rank and alphabetically', async () => {
    expect(store.items[0].name).toBe('MyTestTeam');
    expect(store.items[0].dashboardId).toBe(10);
    expect(store.items[1].name).toBe('Editor');
    expect(store.items[2].name).toBe('Viewer');
    expect(store.items[3].name).toBe('MyTestTeam2');
    expect(store.items[4].name).toBe('MyTestUser');
  });

  describe('when one inherited and one not inherited team permission are added', () => {
    beforeEach(async () => {
      const overridingItemForChildDashboard = {
        team: 'MyTestTeam',
        dashboardId: 1,
        teamId: 1,
        permission: 2,
      };

      store.resetNewType();
      store.newItem.setTeam(overridingItemForChildDashboard.teamId, overridingItemForChildDashboard.team);
      store.newItem.setPermission(overridingItemForChildDashboard.permission);
      await store.addStoreItem();
    });

    it('should add new overriding permission', () => {
      expect(store.items.length).toBe(6);
    });

    it('should be sorted by sort rank and alphabetically', async () => {
      expect(store.items[0].name).toBe('MyTestTeam');
      expect(store.items[0].dashboardId).toBe(10);
      expect(store.items[1].name).toBe('Editor');
      expect(store.items[2].name).toBe('Viewer');
      expect(store.items[3].name).toBe('MyTestTeam');
      expect(store.items[3].dashboardId).toBe(1);
      expect(store.items[4].name).toBe('MyTestTeam2');
      expect(store.items[5].name).toBe('MyTestUser');
    });
  });
});
