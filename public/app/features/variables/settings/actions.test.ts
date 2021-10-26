import { thunkTester } from '../../../../test/core/thunk/thunkTester';
import { initialSettingsState, setStrictPanelRefresh } from './reducer';
import { initStrictPanelRefresh, updateStrictPanelRefresh } from './actions';
import * as runtime from '@grafana/runtime';

function getTestContext() {
  jest.clearAllMocks();
  const updateStrictRefreshPanelMock = jest.fn();
  const state = {
    templating: { settings: { ...initialSettingsState } },
    dashboard: { getModel: () => ({ updateStrictRefreshPanel: updateStrictRefreshPanelMock }) },
  };
  const reportSpy = jest.spyOn(runtime, 'reportInteraction').mockReturnValue(undefined);

  return { reportSpy, state, updateStrictRefreshPanelMock };
}

describe('initStrictPanelRefresh', () => {
  describe('when dispatched', () => {
    it('then report interaction should be invoked and correct actions should be dispatched', async () => {
      const { reportSpy, state } = getTestContext();

      const dispatchedActions = await thunkTester(state).givenThunk(initStrictPanelRefresh).whenThunkIsDispatched(true);

      expect(dispatchedActions).toEqual([setStrictPanelRefresh(true)]);
      expect(reportSpy).toHaveBeenCalledTimes(1);
      expect(reportSpy).toHaveBeenCalledWith('strict_panel_refresh_on_load', { strictPanelRefresh: 1 });
    });
  });
});

describe('updateStrictPanelRefresh', () => {
  describe('when dispatched', () => {
    it('then report interaction should be invoked and correct actions should be dispatched', async () => {
      const { reportSpy, state, updateStrictRefreshPanelMock } = getTestContext();

      const dispatchedActions = await thunkTester(state)
        .givenThunk(updateStrictPanelRefresh)
        .whenThunkIsDispatched(true);

      expect(dispatchedActions).toEqual([setStrictPanelRefresh(true)]);
      expect(reportSpy).toHaveBeenCalledTimes(1);
      expect(reportSpy).toHaveBeenCalledWith('strict_panel_refresh_on_change', { strictPanelRefresh: 1 });
      expect(updateStrictRefreshPanelMock).toHaveBeenCalledTimes(1);
      expect(updateStrictRefreshPanelMock).toHaveBeenCalledWith(true);
    });
  });
});
