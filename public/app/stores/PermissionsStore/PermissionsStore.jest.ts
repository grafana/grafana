import { PermissionsStore } from './PermissionsStore';
import { backendSrv } from 'test/mocks/common';

describe('PermissionsStore', () => {
  let store;

  beforeEach(() => {
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
          teamName: 'MyTestTeam',
        },
      ])
    );

    backendSrv.post = jest.fn();

    store = PermissionsStore.create(
      {
        fetching: false,
        items: [],
      },
      {
        backendSrv: backendSrv,
      }
    );

    return store.load(1, false, false);
  });

  it('should save update on permission change', () => {
    expect(store.items[0].permission).toBe(1);
    expect(store.items[0].permissionName).toBe('View');

    store.updatePermissionOnIndex(0, 2, 'Edit');

    expect(store.items[0].permission).toBe(2);
    expect(store.items[0].permissionName).toBe('Edit');
    expect(backendSrv.post.mock.calls.length).toBe(1);
    expect(backendSrv.post.mock.calls[0][0]).toBe('/api/dashboards/id/1/acl');
  });

  it('should save newly added permissions automatically', () => {
    expect(store.items.length).toBe(3);

    const newItem = {
      userId: 10,
      userLogin: 'tester1',
      permission: 1,
    };
    store.addStoreItem(newItem);

    expect(store.items.length).toBe(4);
    expect(backendSrv.post.mock.calls.length).toBe(1);
    expect(backendSrv.post.mock.calls[0][0]).toBe('/api/dashboards/id/1/acl');
  });

  it('should save removed permissions automatically', () => {
    expect(store.items.length).toBe(3);

    store.removeStoreItem(2);

    expect(store.items.length).toBe(2);
    expect(backendSrv.post.mock.calls.length).toBe(1);
    expect(backendSrv.post.mock.calls[0][0]).toBe('/api/dashboards/id/1/acl');
  });

  describe('when duplicate user permissions are added', () => {
    beforeEach(() => {
      const newItem = {
        userId: 10,
        userLogin: 'tester1',
        permission: 1,
        dashboardId: 1,
      };
      store.addStoreItem(newItem);
      store.addStoreItem(newItem);
    });

    it('should return a validation error', () => {
      expect(store.items.length).toBe(4);
      expect(store.error).toBe('This permission exists already.');
      expect(backendSrv.post.mock.calls.length).toBe(1);
    });
  });

  describe('when duplicate team permissions are added', () => {
    beforeEach(() => {
      const newItem = {
        teamId: 1,
        teamName: 'testerteam',
        permission: 1,
        dashboardId: 1,
      };
      store.addStoreItem(newItem);
      store.addStoreItem(newItem);
    });

    it('should return a validation error', () => {
      expect(store.items.length).toBe(4);
      expect(store.error).toBe('This permission exists already.');
      expect(backendSrv.post.mock.calls.length).toBe(1);
    });
  });

  describe('when duplicate role permissions are added', () => {
    beforeEach(() => {
      const newItem = {
        team: 'MyTestTeam',
        teamId: 1,
        permission: 1,
        dashboardId: 1,
      };
      store.addStoreItem(newItem);
      store.addStoreItem(newItem);
    });

    it('should return a validation error', () => {
      expect(store.items.length).toBe(4);
      expect(store.error).toBe('This permission exists already.');
      expect(backendSrv.post.mock.calls.length).toBe(1);
    });
  });

  describe('when one inherited and one not inherited team permission are added', () => {
    beforeEach(() => {
      const teamItem = {
        team: 'MyTestTeam',
        dashboardId: 1,
        teamId: 1,
        permission: 2,
      };
      store.addStoreItem(teamItem);
    });

    it('should not throw a validation error', () => {
      expect(store.error).toBe(null);
    });

    it('should add both permissions', () => {
      expect(store.items.length).toBe(4);
    });
  });
});
