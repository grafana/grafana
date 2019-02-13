import {
  loadDashboardPermissions,
  dashboardInitFetching,
  dashboardInitCompleted,
  dashboardInitFailed,
  dashboardInitSlow,
} from './actions';
import { OrgRole, PermissionLevel, DashboardState, DashboardInitPhase } from 'app/types';
import { initialState, dashboardReducer } from './reducers';
import { DashboardModel } from './DashboardModel';

describe('dashboard reducer', () => {
  describe('loadDashboardPermissions', () => {
    let state: DashboardState;

    beforeEach(() => {
      const action = loadDashboardPermissions([
        { id: 2, dashboardId: 1, role: OrgRole.Viewer, permission: PermissionLevel.View },
        { id: 3, dashboardId: 1, role: OrgRole.Editor, permission: PermissionLevel.Edit },
      ]);
      state = dashboardReducer(initialState, action);
    });

    it('should add permissions to state', async () => {
      expect(state.permissions.length).toBe(2);
    });
  });

  describe('dashboardInitCompleted', () => {
    let state: DashboardState;

    beforeEach(() => {
      state = dashboardReducer(initialState, dashboardInitFetching());
      state = dashboardReducer(state, dashboardInitSlow());
      state = dashboardReducer(state, dashboardInitCompleted(new DashboardModel({ title: 'My dashboard' })));
    });

    it('should set model', async () => {
      expect(state.model.title).toBe('My dashboard');
    });

    it('should set reset isInitSlow', async () => {
      expect(state.isInitSlow).toBe(false);
    });
  });

  describe('dashboardInitFailed', () => {
    let state: DashboardState;

    beforeEach(() => {
      state = dashboardReducer(initialState, dashboardInitFetching());
      state = dashboardReducer(state, dashboardInitFailed({ message: 'Oh no', error: 'sad' }));
    });

    it('should set model', async () => {
      expect(state.model.title).toBe('Dashboard init failed');
    });

    it('should set reset isInitSlow', async () => {
      expect(state.isInitSlow).toBe(false);
    });

    it('should set initError', async () => {
      expect(state.initError.message).toBe('Oh no');
    });

    it('should set phase failed', async () => {
      expect(state.initPhase).toBe(DashboardInitPhase.Failed);
    });
  });
});
