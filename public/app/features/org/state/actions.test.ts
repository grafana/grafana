import { updateOrganization } from './actions';
import { updateConfigurationSubtitle } from 'app/core/actions';
import { thunkTester } from 'test/core/thunk/thunkTester';

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');

  return {
    ...original,
    getBackendSrv: () => ({
      get: jest.fn().mockResolvedValue({ id: 1, name: 'New Org Name' }),
      put: jest.fn().mockResolvedValue({ id: 1, name: 'New Org Name' }),
    }),
  };
});

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
    it('then it should dispatch updateConfigurationSubtitle', async () => {
      const { initialState } = setup();

      const dispatchedActions = await thunkTester(initialState)
        .givenThunk(updateOrganization)
        .whenThunkIsDispatched();

      expect(dispatchedActions[0].type).toEqual(updateConfigurationSubtitle.type);
      expect(dispatchedActions[0].payload).toEqual(initialState.organization.organization.name);
    });
  });
});
