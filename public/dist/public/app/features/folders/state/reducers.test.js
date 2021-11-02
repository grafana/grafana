import { __assign } from "tslib";
import { OrgRole, PermissionLevel } from 'app/types';
import { folderReducer, initialState, loadFolder, loadFolderPermissions, setFolderTitle } from './reducers';
import { reducerTester } from '../../../../test/core/redux/reducerTester';
function getTestFolder() {
    return {
        id: 1,
        title: 'test folder',
        uid: 'asd',
        url: 'url',
        canSave: true,
        canEdit: true,
        canAdmin: true,
        version: 0,
    };
}
describe('folder reducer', function () {
    describe('when loadFolder is dispatched', function () {
        it('should load folder and set hasChanged to false', function () {
            reducerTester()
                .givenReducer(folderReducer, __assign(__assign({}, initialState), { hasChanged: true }))
                .whenActionIsDispatched(loadFolder(getTestFolder()))
                .thenStateShouldEqual(__assign(__assign(__assign({}, initialState), { hasChanged: false }), getTestFolder()));
        });
    });
    describe('when setFolderTitle is dispatched', function () {
        describe('and title has length', function () {
            it('then state should be correct', function () {
                reducerTester()
                    .givenReducer(folderReducer, __assign({}, initialState))
                    .whenActionIsDispatched(setFolderTitle('ready'))
                    .thenStateShouldEqual(__assign(__assign({}, initialState), { hasChanged: true, title: 'ready' }));
            });
        });
        describe('and title has no length', function () {
            it('then state should be correct', function () {
                reducerTester()
                    .givenReducer(folderReducer, __assign({}, initialState))
                    .whenActionIsDispatched(setFolderTitle(''))
                    .thenStateShouldEqual(__assign(__assign({}, initialState), { hasChanged: false, title: '' }));
            });
        });
    });
    describe('when loadFolderPermissions is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(folderReducer, __assign({}, initialState))
                .whenActionIsDispatched(loadFolderPermissions([
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
            ]))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { permissions: [
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
                ] }));
        });
    });
});
//# sourceMappingURL=reducers.test.js.map