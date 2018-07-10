import React from 'react';
import { shallow } from 'enzyme';
import AddPermissions from './AddPermissions';
import { RootStore } from 'app/stores/RootStore/RootStore';
import { backendSrv } from 'test/mocks/common';

jest.mock('app/core/services/backend_srv', () => ({
  getBackendSrv: () => {
    return {
      get: () => {
        return Promise.resolve([
          { id: 2, dashboardId: 1, role: 'Viewer', permission: 1, permissionName: 'View' },
          { id: 3, dashboardId: 1, role: 'Editor', permission: 1, permissionName: 'Edit' },
        ]);
      },
    };
  },
}));

describe('AddPermissions', () => {
  let wrapper;
  let store;
  let instance;

  beforeAll(() => {
    backendSrv.post = jest.fn(() => Promise.resolve({}));
    backendSrv.get = jest.fn(() =>
      Promise.resolve([
        { id: 2, dashboardId: 1, role: 'Viewer', permission: 1, permissionName: 'View' },
        { id: 3, dashboardId: 1, role: 'Editor', permission: 1, permissionName: 'Edit' },
      ])
    );

    store = RootStore.create(
      {},
      {
        backendSrv: backendSrv,
      }
    );

    wrapper = shallow(<AddPermissions permissions={store.permissions} backendSrv={backendSrv} />);
    instance = wrapper.instance();
    return store.permissions.load(1, true, false);
  });

  describe('when permission for a user is added', () => {
    it('should save permission to db', () => {
      const evt = {
        target: {
          value: 'User',
        },
      };
      const userItem = {
        id: 2,
        login: 'user2',
      };

      instance.typeChanged(evt);
      instance.onUserSelected(userItem);

      wrapper.update();

      expect(wrapper.find('[data-save-permission]').prop('disabled')).toBe(false);

      wrapper.find('form').simulate('submit', { preventDefault() {} });

      expect(backendSrv.post.mock.calls.length).toBe(1);
      expect(backendSrv.post.mock.calls[0][0]).toBe('/api/dashboards/id/1/permissions');
    });
  });

  describe('when permission for team is added', () => {
    it('should save permission to db', () => {
      const evt = {
        target: {
          value: 'Group',
        },
      };

      const teamItem = {
        id: 2,
        name: 'ug1',
      };

      instance.typeChanged(evt);
      instance.teamPicked(teamItem);

      wrapper.update();

      expect(wrapper.find('[data-save-permission]').prop('disabled')).toBe(false);

      wrapper.find('form').simulate('submit', { preventDefault() {} });

      expect(backendSrv.post.mock.calls.length).toBe(1);
      expect(backendSrv.post.mock.calls[0][0]).toBe('/api/dashboards/id/1/permissions');
    });
  });

  afterEach(() => {
    backendSrv.post.mockClear();
  });
});
