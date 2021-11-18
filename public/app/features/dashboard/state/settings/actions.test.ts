import { DashboardModel } from '../DashboardModel';
import { thunkTester } from '../../../../../test/core/thunk/thunkTester';
import { initDashboardSettings, updateShowUnknownVariables } from './actions';
import { setVariableSettings } from './reducer';
import * as runtime from '@grafana/runtime';

describe('initDashboardSettings', () => {
  async function getTestContext() {
    jest.clearAllMocks();
    const mockDashboard = new DashboardModel({ variableSettings: { showUnknowns: false } });
    const reportInteractionSpy = jest.spyOn(runtime, 'reportInteraction').mockImplementation();
    const initialState = {};

    const actions = await thunkTester(initialState)
      .givenThunk(initDashboardSettings)
      .whenThunkIsDispatched(mockDashboard);

    return { actions, reportInteractionSpy };
  }

  describe('when thunk is dispatched', () => {
    it('then the correct actions should be dispatched', async () => {
      const { actions } = await getTestContext();

      expect(actions).toEqual([setVariableSettings({ showUnknowns: false })]);
    });

    it('then reportInteraction is called', async () => {
      const { reportInteractionSpy } = await getTestContext();

      expect(reportInteractionSpy).toHaveBeenCalledTimes(1);
      expect(reportInteractionSpy).toHaveBeenCalledWith('Dashboard variable settings loaded', { showUnknowns: 0 });
    });
  });
});

describe('updateShowUnknownVariables', () => {
  async function getTestContext() {
    jest.clearAllMocks();
    const mockDashboard = new DashboardModel({ variableSettings: { showUnknowns: false } });
    const updateVariableSettingsSpy = jest.spyOn(mockDashboard, 'updateVariableSettings');
    const reportInteractionSpy = jest.spyOn(runtime, 'reportInteraction').mockImplementation();
    const initialState = {
      dashboard: { getModel: () => mockDashboard },
      dashboardSettings: { variables: { showUnknowns: false } },
    };

    const actions = await thunkTester(initialState).givenThunk(updateShowUnknownVariables).whenThunkIsDispatched(true);

    return { actions, updateVariableSettingsSpy, reportInteractionSpy };
  }

  describe('when thunk is dispatched', () => {
    it('then the correct actions should be dispatched', async () => {
      const { actions } = await getTestContext();

      expect(actions).toEqual([setVariableSettings({ showUnknowns: true })]);
    });

    it('then updateVariableSettings is called', async () => {
      const { updateVariableSettingsSpy } = await getTestContext();

      expect(updateVariableSettingsSpy).toHaveBeenCalledTimes(1);
      expect(updateVariableSettingsSpy).toHaveBeenCalledWith({ showUnknowns: true });
    });

    it('then reportInteraction is called', async () => {
      const { reportInteractionSpy } = await getTestContext();

      expect(reportInteractionSpy).toHaveBeenCalledTimes(1);
      expect(reportInteractionSpy).toHaveBeenCalledWith('Dashboard variable settings updated', { showUnknowns: 1 });
    });
  });
});
