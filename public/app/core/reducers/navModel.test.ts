import { reducerTester } from '../../../test/core/redux/reducerTester';
import { navIndexReducer, updateNavIndex, updateConfigurationSubtitle } from './navModel';
import { NavIndex } from '@grafana/data';

describe('navModelReducer', () => {
  describe('when updateNavIndex is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<NavIndex>()
        .givenReducer(navIndexReducer, {})
        .whenActionIsDispatched(
          updateNavIndex({
            id: 'parent',
            text: 'Some Text',
            children: [
              {
                id: 'child',
                text: 'Child',
              },
            ],
          })
        )
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
      const users = { id: 'users', text: 'Users' };
      const teams = { id: 'teams', text: 'Teams' };
      const plugins = { id: 'plugins', text: 'Plugins' };
      const orgsettings = { id: 'org-settings', text: 'Preferences' };
      const apikeys = { id: 'apikeys', text: 'API Keys' };

      const initialState = {
        cfg: { ...originalCfg, children: [datasources, users, teams, plugins, orgsettings, apikeys] },
        datasources: { ...datasources, parentItem: originalCfg },
        users: { ...users, parentItem: originalCfg },
        teams: { ...teams, parentItem: originalCfg },
        plugins: { ...plugins, parentItem: originalCfg },
        'org-settings': { ...orgsettings, parentItem: originalCfg },
        apikeys: { ...apikeys, parentItem: originalCfg },
      };

      const newOrgName = 'Org 2';
      const subTitle = `Organization: ${newOrgName}`;
      const newCfg = { ...originalCfg, subTitle };
      const expectedState = {
        cfg: { ...newCfg, children: [datasources, users, teams, plugins, orgsettings, apikeys] },
        datasources: { ...datasources, parentItem: newCfg },
        users: { ...users, parentItem: newCfg },
        teams: { ...teams, parentItem: newCfg },
        plugins: { ...plugins, parentItem: newCfg },
        'org-settings': { ...orgsettings, parentItem: newCfg },
        apikeys: { ...apikeys, parentItem: newCfg },
      };

      reducerTester<NavIndex>()
        .givenReducer(navIndexReducer, { ...initialState })
        .whenActionIsDispatched(updateConfigurationSubtitle(newOrgName))
        .thenStateShouldEqual(expectedState);
    });
  });
});
