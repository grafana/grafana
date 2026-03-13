import { NavIndex, NavModelItem } from '@grafana/data';

import { reducerTester } from '../../../test/core/redux/reducerTester';

import config, { updateConfig } from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';

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
  });
});

describe('buildInitialState', () => {
  const originalBootData = config.bootData;
  const originalIsExternal = (contextSrv.user as { isExternal?: boolean }).isExternal;
  const originalAuthenticatedBy = contextSrv.user.authenticatedBy;
  const profileNavChildren: NavModelItem[] = [
    {
      id: 'profile/settings',
      text: 'Profile settings',
    },
    {
      id: 'profile/password',
      text: 'Change password',
    },
  ];
  const navTreeMock: NavModelItem[] = [
    { id: 'home', text: 'Home', children: [] },
    { id: 'profile', text: 'Profile', children: profileNavChildren },
  ];

  afterEach(() => {
    updateConfig({ bootData: originalBootData });
    (contextSrv.user as { isExternal?: boolean }).isExternal = originalIsExternal;
    contextSrv.user.authenticatedBy = originalAuthenticatedBy;
  });

  it('removes change password nav entry for external users', () => {
    updateConfig({
      bootData: {
        ...(originalBootData ?? {}),
        navTree: navTreeMock,
      } as any,
    });
    (contextSrv.user as { isExternal?: boolean }).isExternal = true;

    const navIndex = buildInitialState();

    expect(navIndex['profile/password']).toBeUndefined();
    expect(navIndex['profile/settings']).toBeDefined();
  });

  it('keeps change password nav entry for internal users', () => {
    updateConfig({
      bootData: {
        ...(originalBootData ?? {}),
        navTree: navTreeMock,
      } as any,
    });
    (contextSrv.user as { isExternal?: boolean }).isExternal = false;

    const navIndex = buildInitialState();

    expect(navIndex['profile/password']).toBeDefined();
  });

  it('removes change password nav entry when authenticated by external provider', () => {
    updateConfig({
      bootData: {
        ...(originalBootData ?? {}),
        navTree: navTreeMock,
      } as any,
    });
    (contextSrv.user as { isExternal?: boolean }).isExternal = false;
    contextSrv.user.authenticatedBy = 'oauth_google';

    const navIndex = buildInitialState();

    expect(navIndex['profile/password']).toBeUndefined();
    expect(navIndex['profile/settings']).toBeDefined();
  });
});
