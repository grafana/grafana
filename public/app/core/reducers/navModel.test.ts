import { reducerTester } from '../../../test/core/redux/reducerTester';
import { getItemWithNewSubTitle, navIndexReducer, updateNavIndex, updateConfigurationSubtitle } from './navModel';
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
      const initialState = {
        cfg: {
          children: [
            {
              id: 'datasources',
              text: 'Data Sources',
              description: 'Add and configure data sources',
              icon: 'database',
              url: '/datasources',
            },
            {
              id: 'users',
              text: 'Users',
              description: 'Manage org members',
              icon: 'user',
              url: '/org/users',
            },
            {
              id: 'teams',
              text: 'Teams',
              description: 'Manage org groups',
              icon: 'users-alt',
              url: '/org/teams',
            },
            {
              id: 'plugins',
              text: 'Plugins',
              description: 'View and configure plugins',
              icon: 'plug',
              url: '/plugins',
            },
            {
              id: 'org-settings',
              text: 'Preferences',
              description: 'Organization preferences',
              icon: 'sliders-v-alt',
              url: '/org',
            },
            {
              id: 'apikeys',
              text: 'API Keys',
              description: 'Create & manage API keys',
              icon: 'key-skeleton-alt',
              url: '/org/apikeys',
            },
          ],
          icon: 'cog',
          id: 'cfg',
          sortWeight: -1400,
          subTitle: 'Organization: Jake Org',
          text: 'Configuration',
          url: '/datasources',
        },
        datasources: {
          id: 'datasources',
          text: 'Data Sources',
          description: 'Add and configure data sources',
          icon: 'database',
          url: '/datasources',
        },
        users: {
          id: 'users',
          text: 'Users',
          description: 'Manage org members',
          icon: 'user',
          url: '/org/users',
        },
        teams: {
          id: 'teams',
          text: 'Teams',
          description: 'Manage org groups',
          icon: 'users-alt',
          url: '/org/teams',
        },
        plugins: {
          id: 'plugins',
          text: 'Plugins',
          description: 'View and configure plugins',
          icon: 'plug',
          url: '/plugins',
        },
        'org-settings': {
          id: 'org-settings',
          text: 'Preferences',
          description: 'Organization preferences',
          icon: 'sliders-v-alt',
          url: '/org',
        },
        apikeys: {
          id: 'apikeys',
          text: 'API Keys',
          description: 'Create & manage API keys',
          icon: 'key-skeleton-alt',
          url: '/org/apikeys',
        },
      };

      const orgName = 'New Org Name';
      const subTitle = `Organization: ${orgName}`;
      const expectedState = {
        ...initialState,
        cfg: { ...initialState.cfg, subTitle },
        datasources: getItemWithNewSubTitle(initialState.datasources, subTitle),
        users: getItemWithNewSubTitle(initialState.users, subTitle),
        teams: getItemWithNewSubTitle(initialState.teams, subTitle),
        plugins: getItemWithNewSubTitle(initialState.plugins, subTitle),
        'org-settings': getItemWithNewSubTitle(initialState['org-settings'], subTitle),
        apikeys: getItemWithNewSubTitle(initialState.apikeys, subTitle),
      };

      reducerTester<NavIndex>()
        .givenReducer(navIndexReducer, { ...initialState })
        .whenActionIsDispatched(updateConfigurationSubtitle(orgName))
        .thenStateShouldEqual(expectedState);
    });
  });
});
