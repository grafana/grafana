import { thunkTester } from 'test/core/thunk/thunkTester';

import { OrgRole } from '@grafana/data';
import { BackendSrv } from '@grafana/runtime';
import { updateConfigurationSubtitle } from 'app/core/actions';

import { updateOrganization, setUserOrganization, getUserOrganizations } from './actions';

const setup = () => {
  const initialState = {
    organization: {
      organization: {
        id: 1,
        name: 'New Org Name',
      },
      userOrg: [{ orgId: 1, name: 'New Org Name', role: OrgRole.Editor }],
    },
  };

  return {
    initialState,
  };
};

describe('updateOrganization', () => {
  describe('when updateOrganization thunk is dispatched', () => {
    const getMock = jest.fn().mockResolvedValue({ id: 1, name: 'New Org Name' });
    const putMock = jest.fn().mockResolvedValue({ id: 1, name: 'New Org Name' });
    const backendSrvMock = {
      get: getMock,
      put: putMock,
    } as unknown as BackendSrv;

    it('then it should dispatch updateConfigurationSubtitle', async () => {
      const { initialState } = setup();

      const dispatchedActions = await thunkTester(initialState)
        .givenThunk(updateOrganization)
        .whenThunkIsDispatched({ getBackendSrv: () => backendSrvMock });

      expect(dispatchedActions[0].type).toEqual(updateConfigurationSubtitle.type);
      expect(dispatchedActions[0].payload).toEqual(initialState.organization.organization.name);
    });
  });
});

describe('setUserOrganization', () => {
  describe('when setUserOrganization thunk is dispatched', () => {
    const postMock = jest.fn().mockResolvedValue({ id: 1, name: 'New Org Name' });

    const backendSrvMock = {
      post: postMock,
    } as unknown as BackendSrv;

    const orgId = 1;

    it('then it should dispatch updateConfigurationSubtitle', async () => {
      const { initialState } = setup();

      const dispatchedActions = await thunkTester(initialState)
        .givenThunk(setUserOrganization)
        .whenThunkIsDispatched(orgId, { getBackendSrv: () => backendSrvMock });

      expect(dispatchedActions[0].type).toEqual(updateConfigurationSubtitle.type);
      expect(dispatchedActions[0].payload).toEqual(initialState.organization.organization.name);
    });
  });
});

describe('getUserOrganizations', () => {
  describe('when getUserOrganizations thunk is dispatched', () => {
    const getMock = jest.fn().mockResolvedValue({ orgId: 1, name: 'New Org Name', role: OrgRole.Editor });
    const backendSrvMock = {
      get: getMock,
    } as unknown as BackendSrv;

    it('then it should dispatch updateConfigurationSubtitle', async () => {
      const { initialState } = setup();

      const dispatchedActions = await thunkTester(initialState)
        .givenThunk(getUserOrganizations)
        .whenThunkIsDispatched({ getBackendSrv: () => backendSrvMock });

      expect(dispatchedActions[0].payload).toEqual(initialState.organization.userOrg[0]);
    });
  });
});
