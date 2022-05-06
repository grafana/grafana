import { DashboardInitPhase, DashboardState, OrgRole, PermissionLevel } from 'app/types';

import { DashboardModel } from './DashboardModel';
import { fetchDashboardPermissions } from './actions';
import {
  dashboardInitCompleted,
  dashboardInitFailed,
  dashboardInitFetching,
  dashboardReducer,
  initialDash,
  initialState,
} from './reducers';

describe('dashboard reducer', () => {
  describe('fetchDashboardPermissions', () => {
    let state: DashboardState;

    beforeEach(() => {
      const action = fetchDashboardPermissions.fulfilled(
        {
          key: 'home',
          dashboardAclDTOs: [
            { id: 2, dashboardId: 1, role: OrgRole.Viewer, permission: PermissionLevel.View },
            { id: 3, dashboardId: 1, role: OrgRole.Editor, permission: PermissionLevel.Edit },
          ],
        },
        '',
        ''
      );
      state = dashboardReducer({ currentKey: 'home', byKey: { home: { ...initialDash } } }, action);
    });

    it('should add permissions to state', async () => {
      expect(state.byKey['home'].permissions?.length).toBe(2);
    });
  });

  describe('dashboardInitCompleted', () => {
    let state: DashboardState;

    beforeEach(() => {
      state = dashboardReducer(initialState, dashboardInitFetching({ key: 'home' }));
      state = dashboardReducer(
        state,
        dashboardInitCompleted({
          dash: new DashboardModel({
            title: 'My dashboard',
            panels: [{ id: 1 }, { id: 2 }],
          }),
          key: 'home',
        })
      );
    });

    it('should set model', async () => {
      expect(state.byKey['home'].getModel()!.title).toBe('My dashboard');
    });
  });

  describe('dashboardInitFailed', () => {
    let state: DashboardState;

    beforeEach(() => {
      state = dashboardReducer(initialState, dashboardInitFetching({ key: 'home' }));
      state = dashboardReducer(state, dashboardInitFailed({ message: 'Oh no', error: 'sad', key: 'home' }));
    });

    it('should set model', async () => {
      expect(state.byKey['home'].getModel()?.title).toBe('Dashboard init failed');
    });

    it('should set initError', async () => {
      expect(state.byKey['home'].initError?.message).toBe('Oh no');
    });

    it('should set phase failed', async () => {
      expect(state.byKey['home'].initPhase).toBe(DashboardInitPhase.Failed);
    });
  });
});
