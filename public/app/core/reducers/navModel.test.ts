import { type NavIndex } from '@grafana/data';
import { config } from '@grafana/runtime';

import { reducerTester } from '../../../test/core/redux/reducerTester';

import { buildInitialState, navIndexReducer, updateNavIndex, updateConfigurationSubtitle } from './navModel';

describe('navModelReducer', () => {
  const originalFeatureToggles = config.featureToggles;
  const originalBootData = config.bootData;

  afterEach(() => {
    config.featureToggles = originalFeatureToggles;
    config.bootData = originalBootData;
  });

  describe('buildInitialState', () => {
    it('filters the nav index by job role when job role nav presets are enabled', () => {
      config.featureToggles = { ...originalFeatureToggles, jobRoleNavPresets: true };
      config.bootData = {
        ...originalBootData,
        user: {
          ...originalBootData.user,
          navbar: { bookmarkUrls: [], jobRole: 'data-analyst' },
        },
        navTree: [
          { id: 'home', text: 'Home' },
          { id: 'dashboards/browse', text: 'Dashboards' },
          { id: 'explore', text: 'Explore' },
          { id: 'alerting', text: 'Alerting' },
          { id: 'cfg', text: 'Administration' },
        ],
      };

      const navIndex = buildInitialState();

      expect(Object.keys(navIndex)).toContain('explore');
      expect(Object.keys(navIndex)).not.toContain('alerting');
      expect(Object.keys(navIndex)).not.toContain('cfg');
    });
  });

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
  });
});
