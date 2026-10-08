import { type NavIndex, PluginIncludeType } from '@grafana/data';

import { reducerTester } from '../../../test/core/redux/reducerTester';
import { NavID } from '../navtree/constants';
import { setupNavTestApps, setupNavTestState } from '../navtree/test-utils';

import { buildInitialState, navIndexReducer, updateNavIndex, updateConfigurationSubtitle } from './navModel';

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
      const correlations = { id: 'correlations', text: 'Correlations' };
      const users = { id: 'users', text: 'Users' };
      const teams = { id: 'teams', text: 'Teams' };
      const plugins = { id: 'plugins', text: 'Plugins' };
      const orgsettings = { id: 'org-settings', text: 'Preferences' };

      const initialState = {
        cfg: { ...originalCfg, children: [datasources, users, teams, plugins, orgsettings] },
        datasources: { ...datasources, parentItem: originalCfg },
        correlations: { ...correlations, parentItem: originalCfg },
        users: { ...users, parentItem: originalCfg },
        teams: { ...teams, parentItem: originalCfg },
        plugins: { ...plugins, parentItem: originalCfg },
        'org-settings': { ...orgsettings, parentItem: originalCfg },
      };

      const newOrgName = 'Org 2';
      const subTitle = `Organization: ${newOrgName}`;
      const newCfg = { ...originalCfg, subTitle };
      const expectedState = {
        cfg: { ...newCfg, children: [datasources, users, teams, plugins, orgsettings] },
        datasources: { ...datasources, parentItem: newCfg },
        correlations: { ...correlations, parentItem: newCfg },
        users: { ...users, parentItem: newCfg },
        teams: { ...teams, parentItem: newCfg },
        plugins: { ...plugins, parentItem: newCfg },
        'org-settings': { ...orgsettings, parentItem: newCfg },
      };

      reducerTester<NavIndex>()
        .givenReducer(navIndexReducer, { ...initialState })
        .whenActionIsDispatched(updateConfigurationSubtitle(newOrgName))
        .thenStateShouldEqual(expectedState);
    });

    it('then it should skip nav entries missing from the nav index', () => {
      const originalCfg = { id: 'cfg', subTitle: 'Organization: Org 1', text: 'Configuration' };
      const users = { id: 'users', text: 'Users' };

      const initialState = {
        cfg: { ...originalCfg, children: [users] },
        users: { ...users, parentItem: originalCfg },
      };

      const newOrgName = 'Org 2';
      const subTitle = `Organization: ${newOrgName}`;
      const newCfg = { ...originalCfg, subTitle };

      reducerTester<NavIndex>()
        .givenReducer(navIndexReducer, { ...initialState })
        .whenActionIsDispatched(updateConfigurationSubtitle(newOrgName))
        .thenStateShouldEqual({
          cfg: { ...newCfg, children: [users] },
          users: { ...users, parentItem: newCfg },
        });
    });
  });
});

// The /apps landing page renders its cards from navIndex while the mega menu
// reads the tree, so the two have to agree on the order of "More apps".
describe('buildInitialState', () => {
  const app = (id: string, name: string) => ({
    id,
    name,
    includes: [{ type: PluginIncludeType.page, name: 'Page', path: `/a/${id}`, addToNav: true }],
  });

  beforeEach(() => {
    setupNavTestState({
      permissions: ['plugins.app:access'],
      orgRole: 'Admin',
      openFeatureFlags: { 'grafana.multiTenantNavTree': true, 'plugins.useMTPlugins': true },
    });
  });

  afterEach(() => {
    setupNavTestApps();
  });

  it('orders the indexed More apps children by translated text', () => {
    setupNavTestApps([app('c-app', 'Charlie'), app('a-app', 'Alpha'), app('b-app', 'Bravo')]);

    const apps = buildInitialState()[NavID.apps];

    expect(apps.children?.map((child) => child.text)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });
});
