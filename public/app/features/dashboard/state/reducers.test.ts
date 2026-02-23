import { DashboardInitPhase, DashboardState } from 'app/types/dashboard';

import { createDashboardModelFixture, createPanelSaveModel } from './__fixtures__/dashboardFixtures';
import {
  dashboardInitCompleted,
  dashboardInitFailed,
  dashboardInitFetching,
  dashboardReducer,
  initialState,
} from './reducers';

describe('dashboard reducer', () => {
  describe('dashboardInitCompleted', () => {
    let state: DashboardState;

    beforeEach(() => {
      state = dashboardReducer(initialState, dashboardInitFetching());
      state = dashboardReducer(
        state,
        dashboardInitCompleted(
          createDashboardModelFixture({
            title: 'My dashboard',
            panels: [createPanelSaveModel({ id: 1 }), createPanelSaveModel({ id: 2 })],
          })
        )
      );
    });

    it('should set model', async () => {
      expect(state.getModel()!.title).toBe('My dashboard');
    });
  });

  describe('dashboardInitFailed', () => {
    let state: DashboardState;

    beforeEach(() => {
      state = dashboardReducer(initialState, dashboardInitFetching());
      state = dashboardReducer(state, dashboardInitFailed({ message: 'Oh no', error: 'sad' }));
    });

    it('should set model', async () => {
      expect(state.getModel()?.title).toBe('Dashboard init failed');
    });

    it('should set initError', async () => {
      expect(state.initError?.message).toBe('Oh no');
    });

    it('should set phase failed', async () => {
      expect(state.initPhase).toBe(DashboardInitPhase.Failed);
    });
  });
});
