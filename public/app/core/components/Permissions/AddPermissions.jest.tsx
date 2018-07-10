import React from 'react';
import { shallow } from 'enzyme';
import AddPermissions from './AddPermissions';
import { RootStore } from 'app/stores/RootStore/RootStore';
import { getBackendSrv } from 'app/core/services/backend_srv';

jest.mock('app/core/services/backend_srv', () => ({
  getBackendSrv: () => {
    return {
      get: () => {
        return Promise.resolve([
          { id: 2, dashboardId: 1, role: 'Viewer', permission: 1, permissionName: 'View' },
          { id: 3, dashboardId: 1, role: 'Editor', permission: 1, permissionName: 'Edit' },
        ]);
      },
      post: jest.fn(() => Promise.resolve({})),
    };
  },
}));

describe('AddPermissions', () => {
  let wrapper;
  let store;
  let instance;
  let backendSrv: any = getBackendSrv();

  beforeAll(() => {
    store = RootStore.create({}, { backendSrv: backendSrv });
    wrapper = shallow(<AddPermissions permissions={store.permissions} />);
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

      instance.onTypeChanged(evt);
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

      instance.onTypeChanged(evt);
      instance.onTeamSelected(teamItem);

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
