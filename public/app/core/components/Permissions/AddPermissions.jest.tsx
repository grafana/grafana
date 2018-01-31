import React from 'react';
import AddPermissions from './AddPermissions';
import { RootStore } from 'app/stores/RootStore/RootStore';
import { backendSrv } from 'test/mocks/common';
import { shallow } from 'enzyme';

describe('AddPermissions', () => {
  let wrapper;

  beforeAll(() => {
    backendSrv.get.mockReturnValue(
      Promise.resolve([
        { id: 2, dashboardId: 1, role: 'Viewer', permission: 1, permissionName: 'View' },
        { id: 3, dashboardId: 1, role: 'Editor', permission: 1, permissionName: 'Edit' },
        {
          id: 4,
          dashboardId: 1,
          userId: 2,
          userLogin: 'danlimerick',
          userEmail: 'dan.limerick@gmail.com',
          permission: 4,
          permissionName: 'Admin',
        },
      ])
    );

    backendSrv.post = jest.fn();

    const store = RootStore.create(
      {},
      {
        backendSrv: backendSrv,
      }
    );

    // wrapper = shallow(<Permissions backendSrv={backendSrv} isFolder={true} dashboardId={1} {...store} />);
    wrapper = shallow(<AddPermissions permissions={store.permissions} backendSrv={backendSrv} dashboardId={1} />);
    //<AddPermissions permissions={permissions} backendSrv={backendSrv} dashboardId={dashboardId} />
    // return wrapper.instance().loadStore(1, true);
  });

  describe('when permission for a user is added', () => {
    it('should save permission to db', async () => {
      const evt = {
        target: {
          value: 'User',
        },
      };
      const userItem = {
        id: 2,
        login: 'user2',
      };

      const instance = wrapper.instance();
      instance.typeChanged(evt);
      instance.userPicked(userItem);
      wrapper.find('[data-save-permission]').simulate('click');
      expect(backendSrv.post.mock.calls.length).toBe(1);
      expect(backendSrv.post.mock.calls[0][0]).toBe('/api/dashboards/id/1/acl');
    });
  });

  //   describe('when permission for team is added', () => {
  //     it('should save permission to db', () => {
  //       const teamItem = {
  //         id: 2,
  //         name: 'ug1',
  //       };

  //       wrapper
  //         .instance()
  //         .teamPicked(teamItem)
  //         .then(() => {
  //           expect(backendSrv.post.mock.calls.length).toBe(1);
  //           expect(backendSrv.post.mock.calls[0][0]).toBe('/api/dashboards/id/1/acl');
  //         });
  //     });
  //   });
});
