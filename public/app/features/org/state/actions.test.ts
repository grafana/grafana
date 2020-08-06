import { updateOrganization } from './actions';
import { updateConfigurationSubtitle } from 'app/core/actions';
import { thunkTester } from 'test/core/thunk/thunkTester';

const setup = () => {
  const initialState = {
    organization: {
      organization: {
        id: 1,
        name: 'New Org Name',
      },
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
    const backendSrvMock: any = {
      get: getMock,
      put: putMock,
    };

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
