import { FolderDTO, FolderState, OrgRole, PermissionLevel } from 'app/types';
import { folderReducer, initialState, loadFolder, loadFolderPermissions, setFolderTitle } from './reducers';
import { reducerTester } from '../../../../test/core/redux/reducerTester';

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
  describe('when loadFolder is dispatched', () => {
    it('should load folder and set hasChanged to false', () => {
      reducerTester<FolderState>()
        .givenReducer(folderReducer, { ...initialState, hasChanged: true })
        .whenActionIsDispatched(loadFolder(getTestFolder()))
        .thenStateShouldEqual({
          ...initialState,
          hasChanged: false,
          ...getTestFolder(),
        });
    });
  });

  describe('when setFolderTitle is dispatched', () => {
    describe('and title has length', () => {
      it('then state should be correct', () => {
        reducerTester<FolderState>()
          .givenReducer(folderReducer, { ...initialState })
          .whenActionIsDispatched(setFolderTitle('ready'))
          .thenStateShouldEqual({
            ...initialState,
            hasChanged: true,
            title: 'ready',
          });
      });
    });

    describe('and title has no length', () => {
      it('then state should be correct', () => {
        reducerTester<FolderState>()
          .givenReducer(folderReducer, { ...initialState })
          .whenActionIsDispatched(setFolderTitle(''))
          .thenStateShouldEqual({
            ...initialState,
            hasChanged: false,
            title: '',
          });
      });
    });
  });

  describe('when loadFolderPermissions is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<FolderState>()
        .givenReducer(folderReducer, { ...initialState })
        .whenActionIsDispatched(
          loadFolderPermissions([
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
          ])
        )
        .thenStateShouldEqual({
          ...initialState,
          permissions: [
            {
              dashboardId: 10,
              id: 4,
              inherited: true,
              name: 'MyTestTeam',
              permission: 1,
              sortRank: 120,
              team: 'MyTestTeam',
              teamId: 1,
            },
            {
              dashboardId: 1,
              icon: 'fa fa-fw fa-street-view',
              id: 3,
              name: 'Editor',
              permission: 2,
              role: OrgRole.Editor,
              sortRank: 31,
            },
            {
              dashboardId: 1,
              icon: 'fa fa-fw fa-street-view',
              id: 2,
              name: 'Viewer',
              permission: 1,
              role: OrgRole.Viewer,
              sortRank: 30,
            },
            {
              dashboardId: 1,
              id: 6,
              name: 'MyTestTeam2',
              permission: 2,
              sortRank: 20,
              team: 'MyTestTeam2',
              teamId: 2,
            },
            {
              dashboardId: 1,
              id: 5,
              name: 'MyTestUser',
              permission: 1,
              sortRank: 10,
              userId: 1,
              userLogin: 'MyTestUser',
            },
          ],
        });
    });
  });
});
