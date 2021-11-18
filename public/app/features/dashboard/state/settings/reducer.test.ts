import { reducerTester } from '../../../../../test/core/redux/reducerTester';
import { DashboardSettingsState } from './types';
import { dashboardSettingsReducer, initialDashboardSettingsState, setVariableSettings } from './reducer';

describe('dashboardSettingsReducer', () => {
  it('initial state should be correct', () => {
    reducerTester<DashboardSettingsState>()
      .givenReducer(dashboardSettingsReducer, { ...initialDashboardSettingsState })
      .whenActionIsDispatched({ type: '' })
      .thenStateShouldEqual({ variables: { showUnknowns: true } });
  });

  describe('when setVariableSettings is dispatched', () => {
    it('then the resulting state should be correct', () => {
      reducerTester<DashboardSettingsState>()
        .givenReducer(dashboardSettingsReducer, { ...initialDashboardSettingsState })
        .whenActionIsDispatched(setVariableSettings({ showUnknowns: false }))
        .thenStateShouldEqual({ variables: { showUnknowns: false } });
    });
  });
});
