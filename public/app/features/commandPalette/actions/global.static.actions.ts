import { Action, Priority } from 'kbar';
import { flatMapDeep } from 'lodash';

import { NavModelItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { changeTheme } from 'app/core/services/theme';

import { alertingCommandPaletteStaticActions } from './alerting.static.actions';

export interface NavBarActions {
  url: string;
  actions: Action[];
}

export default (navBarTree: NavModelItem[]) => {
  const globalActions: Action[] = [
    {
      id: 'go/search',
      name: 'Go to dashboard search',
      keywords: 'navigate',
      perform: () => locationService.push('?search=open'),
      section: 'Navigation',
      shortcut: ['s', 'o'],
    },
    {
      id: 'go/dashboard',
      name: 'Go to dashboard...',
      keywords: 'navigate',
      section: 'Navigation',
      priority: Priority.NORMAL,
    },
    {
      id: 'preferences/theme',
      name: 'Change theme...',
      keywords: 'interface color dark light',
      section: 'Preferences',
      shortcut: ['c', 't'],
    },
    {
      id: 'preferences/dark-theme',
      name: 'Dark',
      keywords: 'dark theme',
      section: '',
      perform: () => changeTheme('dark'),
      parent: 'preferences/theme',
    },
    {
      id: 'preferences/light-theme',
      name: 'Light',
      keywords: 'light theme',
      section: '',
      perform: () => changeTheme('light'),
      parent: 'preferences/theme',
    },
  ];

  // this maps actions to navbar by URL items for showing/hiding
  // actions is an array for multiple child actions that would be under one navbar item
  const navBarActionMap: NavBarActions[] = [
    {
      url: '/dashboard/new',
      actions: [
        {
          id: 'management/create-folder',
          name: 'Create folder',
          keywords: 'new add',
          perform: () => locationService.push('/dashboards/folder/new'),
          section: 'Management',
        },
        {
          id: 'management/create-dashboard',
          name: 'Create dashboard',
          keywords: 'new add',
          perform: () => locationService.push('/dashboard/new'),
          section: 'Management',
        },
      ],
    },
    {
      url: '/',
      actions: [
        {
          id: 'go/home',
          name: 'Go to home',
          keywords: 'navigate',
          perform: () => locationService.push('/'),
          section: 'Navigation',
          shortcut: ['g', 'h'],
          priority: Priority.HIGH,
        },
      ],
    },
    {
      url: '/explore',
      actions: [
        {
          id: 'go/explore',
          name: 'Go to explore',
          keywords: 'navigate',
          perform: () => locationService.push('/explore'),
          section: 'Navigation',
          priority: Priority.NORMAL,
        },
      ],
    },
    ...alertingCommandPaletteStaticActions,
    {
      url: '/profile',
      actions: [
        {
          id: 'go/profile',
          name: 'Go to profile',
          keywords: 'navigate preferences',
          perform: () => locationService.push('/profile'),
          section: 'Navigation',
          shortcut: ['g', 'p'],
          priority: Priority.LOW,
        },
      ],
    },
    {
      url: '/datasources',
      actions: [
        {
          id: 'go/configuration',
          name: 'Go to data sources configuration',
          keywords: 'navigate settings ds',
          perform: () => locationService.push('/datasources'),
          section: 'Navigation',
        },
      ],
    },
  ];

  const navBarActions: Action[] = [];
  const navBarFlatUrls = flatMapDeep(navBarTree, (nbt) => nbt.children)
    .map((nbf) => nbf?.url)
    .filter((url) => url !== undefined);

  navBarActionMap.forEach((navBarAction) => {
    const navBarItem = navBarFlatUrls.find((url) => navBarAction.url === url);
    if (navBarItem) {
      navBarActions.push(...navBarAction.actions);
    }
  });

  return [...globalActions, ...navBarActions];
};
