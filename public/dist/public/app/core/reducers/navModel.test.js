import { __assign } from "tslib";
import { reducerTester } from '../../../test/core/redux/reducerTester';
import { navIndexReducer, updateNavIndex, updateConfigurationSubtitle } from './navModel';
describe('navModelReducer', function () {
    describe('when updateNavIndex is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(navIndexReducer, {})
                .whenActionIsDispatched(updateNavIndex({
                id: 'parent',
                text: 'Some Text',
                children: [
                    {
                        id: 'child',
                        text: 'Child',
                    },
                ],
            }))
                .thenStateShouldEqual({
                child: {
                    id: 'child',
                    text: 'Child',
                    parentItem: {
                        id: 'parent',
                        text: 'Some Text',
                        children: [
                            {
                                id: 'child',
                                text: 'Child',
                            },
                        ],
                    },
                },
            });
        });
    });
    describe('when updateConfigurationSubtitle is dispatched', function () {
        it('then state should be correct', function () {
            var originalCfg = { id: 'cfg', subTitle: 'Organization: Org 1', text: 'Configuration' };
            var datasources = { id: 'datasources', text: 'Data Sources' };
            var users = { id: 'users', text: 'Users' };
            var teams = { id: 'teams', text: 'Teams' };
            var plugins = { id: 'plugins', text: 'Plugins' };
            var orgsettings = { id: 'org-settings', text: 'Preferences' };
            var apikeys = { id: 'apikeys', text: 'API Keys' };
            var initialState = {
                cfg: __assign(__assign({}, originalCfg), { children: [datasources, users, teams, plugins, orgsettings, apikeys] }),
                datasources: __assign(__assign({}, datasources), { parentItem: originalCfg }),
                users: __assign(__assign({}, users), { parentItem: originalCfg }),
                teams: __assign(__assign({}, teams), { parentItem: originalCfg }),
                plugins: __assign(__assign({}, plugins), { parentItem: originalCfg }),
                'org-settings': __assign(__assign({}, orgsettings), { parentItem: originalCfg }),
                apikeys: __assign(__assign({}, apikeys), { parentItem: originalCfg }),
            };
            var newOrgName = 'Org 2';
            var subTitle = "Organization: " + newOrgName;
            var newCfg = __assign(__assign({}, originalCfg), { subTitle: subTitle });
            var expectedState = {
                cfg: __assign(__assign({}, newCfg), { children: [datasources, users, teams, plugins, orgsettings, apikeys] }),
                datasources: __assign(__assign({}, datasources), { parentItem: newCfg }),
                users: __assign(__assign({}, users), { parentItem: newCfg }),
                teams: __assign(__assign({}, teams), { parentItem: newCfg }),
                plugins: __assign(__assign({}, plugins), { parentItem: newCfg }),
                'org-settings': __assign(__assign({}, orgsettings), { parentItem: newCfg }),
                apikeys: __assign(__assign({}, apikeys), { parentItem: newCfg }),
            };
            reducerTester()
                .givenReducer(navIndexReducer, __assign({}, initialState))
                .whenActionIsDispatched(updateConfigurationSubtitle(newOrgName))
                .thenStateShouldEqual(expectedState);
        });
    });
});
//# sourceMappingURL=navModel.test.js.map