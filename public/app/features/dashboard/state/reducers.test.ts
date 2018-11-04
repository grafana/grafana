import { Action, ActionTypes } from './actions';
import { OrgRole, PermissionLevel, DashboardState } from 'app/types';
import { initialState, dashboardReducer } from './reducers';

describe('dashboard reducer', () => {
  describe('loadDashboardPermissions', () => {
    let state: DashboardState;

    beforeEach(() => {
      const action: Action = {
        type: ActionTypes.LoadDashboardPermissions,
        payload: [
          { id: 2, dashboardId: 1, role: OrgRole.Viewer, permission: PermissionLevel.View },
          { id: 3, dashboardId: 1, role: OrgRole.Editor, permission: PermissionLevel.Edit },
        ],
      };
      state = dashboardReducer(initialState, action);
    });

    it('should add permissions to state', async () => {
      expect(state.permissions.length).toBe(2);
    });
  });
});
