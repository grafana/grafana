import { reducerTester } from '../../../test/core/redux/reducerTester';
import { navIndexReducer, updateNavIndex, updateConfigurationSubtitle } from './navModel';
describe('navModelReducer', () => {
    describe('when updateNavIndex is dispatched', () => {
        it('then state should be correct', () => {
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
    describe('when updateConfigurationSubtitle is dispatched', () => {
        it('then state should be correct', () => {
            const originalCfg = { id: 'cfg', subTitle: 'Organization: Org 1', text: 'Configuration' };
            const datasources = { id: 'datasources', text: 'Data Sources' };
            const correlations = { id: 'correlations', text: 'Correlations' };
            const users = { id: 'users', text: 'Users' };
            const teams = { id: 'teams', text: 'Teams' };
            const plugins = { id: 'plugins', text: 'Plugins' };
            const orgsettings = { id: 'org-settings', text: 'Preferences' };
            const apikeys = { id: 'apikeys', text: 'API Keys' };
            const initialState = {
                cfg: Object.assign(Object.assign({}, originalCfg), { children: [datasources, users, teams, plugins, orgsettings, apikeys] }),
                datasources: Object.assign(Object.assign({}, datasources), { parentItem: originalCfg }),
                correlations: Object.assign(Object.assign({}, correlations), { parentItem: originalCfg }),
                users: Object.assign(Object.assign({}, users), { parentItem: originalCfg }),
                teams: Object.assign(Object.assign({}, teams), { parentItem: originalCfg }),
                plugins: Object.assign(Object.assign({}, plugins), { parentItem: originalCfg }),
                'org-settings': Object.assign(Object.assign({}, orgsettings), { parentItem: originalCfg }),
                apikeys: Object.assign(Object.assign({}, apikeys), { parentItem: originalCfg }),
            };
            const newOrgName = 'Org 2';
            const subTitle = `Organization: ${newOrgName}`;
            const newCfg = Object.assign(Object.assign({}, originalCfg), { subTitle });
            const expectedState = {
                cfg: Object.assign(Object.assign({}, newCfg), { children: [datasources, users, teams, plugins, orgsettings, apikeys] }),
                datasources: Object.assign(Object.assign({}, datasources), { parentItem: newCfg }),
                correlations: Object.assign(Object.assign({}, correlations), { parentItem: newCfg }),
                users: Object.assign(Object.assign({}, users), { parentItem: newCfg }),
                teams: Object.assign(Object.assign({}, teams), { parentItem: newCfg }),
                plugins: Object.assign(Object.assign({}, plugins), { parentItem: newCfg }),
                'org-settings': Object.assign(Object.assign({}, orgsettings), { parentItem: newCfg }),
                apikeys: Object.assign(Object.assign({}, apikeys), { parentItem: newCfg }),
            };
            reducerTester()
                .givenReducer(navIndexReducer, Object.assign({}, initialState))
                .whenActionIsDispatched(updateConfigurationSubtitle(newOrgName))
                .thenStateShouldEqual(expectedState);
        });
    });
});
//# sourceMappingURL=navModel.test.js.map