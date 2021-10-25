import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { initialSettingsState, setStrictPanelRefresh, settingsReducer, SettingsState } from './reducer';

describe('settingsReducer', () => {
  it('should have correct initial state', () => {
    reducerTester<SettingsState>()
      .givenReducer(settingsReducer, { ...initialSettingsState })
      .whenActionIsDispatched({ type: '' })
      .thenStateShouldEqual({ strictPanelRefreshMode: false });
  });

  describe('when setStrictPanelRefresh is dispatched', () => {
    it('then the state should be correct', () => {
      reducerTester<SettingsState>()
        .givenReducer(settingsReducer, { ...initialSettingsState })
        .whenActionIsDispatched(setStrictPanelRefresh(true))
        .thenStateShouldEqual({ strictPanelRefreshMode: true });
    });
  });
});
