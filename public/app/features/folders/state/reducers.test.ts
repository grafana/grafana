import { Action, ActionTypes } from './actions';
import { FolderDTO, OrgRole, PermissionLevel, FolderState } from 'app/types';
import { inititalState, folderReducer } from './reducers';

function getTestFolder(): FolderDTO {
  return {
    id: 1,
    title: 'test folder',
    uid: 'asd',
    url: 'url',
    canSave: true,
    version: 0,
  };
}

describe('folder reducer', () => {
  describe('loadFolder', () => {
    it('should load folder and set hasChanged to false', () => {
      const folder = getTestFolder();

      const action: Action = {
        type: ActionTypes.LoadFolder,
        payload: folder,
      };

      const state = folderReducer(inititalState, action);

      expect(state.hasChanged).toEqual(false);
      expect(state.title).toEqual('test folder');
    });
  });

  describe('detFolderTitle', () => {
    it('should set title', () => {
      const action: Action = {
        type: ActionTypes.SetFolderTitle,
        payload: 'new title',
      };

      const state = folderReducer(inititalState, action);

      expect(state.hasChanged).toEqual(true);
      expect(state.title).toEqual('new title');
    });
  });

  describe('loadFolderPermissions', () => {
    let state: FolderState;

    beforeEach(() => {
      const action: Action = {
        type: ActionTypes.LoadFolderPermissions,
        payload: [
          { id: 2, dashboardId: 1, role: OrgRole.Viewer, permission: PermissionLevel.View },
          { id: 3, dashboardId: 1, role: OrgRole.Editor, permission: PermissionLevel.Edit },
          {
            id: 4,
            dashboardId: 10,
            permission: PermissionLevel.View,
            teamId: 1,
            team: 'MyTestTeam',
            inherited: true,
          },
          {
            id: 5,
            dashboardId: 1,
            permission: PermissionLevel.View,
            userId: 1,
            userLogin: 'MyTestUser',
          },
          {
            id: 6,
            dashboardId: 1,
            permission: PermissionLevel.Edit,
            teamId: 2,
            team: 'MyTestTeam2',
          },
        ],
      };

      state = folderReducer(inititalState, action);
    });

    it('should add permissions to state', async () => {
      expect(state.permissions.length).toBe(5);
    });

    it('should be sorted by sort rank and alphabetically', async () => {
      expect(state.permissions[0].name).toBe('MyTestTeam');
      expect(state.permissions[0].dashboardId).toBe(10);
      expect(state.permissions[1].name).toBe('Editor');
      expect(state.permissions[2].name).toBe('Viewer');
      expect(state.permissions[3].name).toBe('MyTestTeam2');
      expect(state.permissions[4].name).toBe('MyTestUser');
    });
  });
});
