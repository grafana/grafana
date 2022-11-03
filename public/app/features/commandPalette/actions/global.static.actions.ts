import { Action, Priority } from 'kbar';

import { NavModelItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { isTruthy } from 'app/core/utils/types';

export interface NavBarActions {
  url: string;
  actions: Action[];
}

export default (navBarTree: NavModelItem[]) => {
  const globalActions: Action[] = [
    {
      id: 'go/dashboard',
      name: 'Dashboards...',
      keywords: 'navigate',
      section: 'Navigation',
      priority: Priority.NORMAL,
    },
    {
      id: 'go/search',
      name: 'Go to Search',
      keywords: 'navigate',
      perform: () => locationService.push('?search=open'),
      section: 'Navigation',
      shortcut: ['s', 'o'],
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
      perform: () => {
        locationService.push({ search: '?theme=dark' });
        location.reload();
      },
      parent: 'preferences/theme',
    },
    {
      id: 'preferences/light-theme',
      name: 'Light',
      keywords: 'light theme',
      section: '',
      perform: () => {
        locationService.push({ search: '?theme=light' });
        location.reload();
      },
      parent: 'preferences/theme',
    },
  ];

  interface NavItemWithParent extends NavModelItem {
    parent?: NavModelItem;
  }

  const flatNavTree = navBarTree.flatMap<NavItemWithParent>((navItem) => {
    // exclude parent items without URLs because we can't navigate to them
    if (!navItem.url) {
      return [];
    }

    const children = (navItem.children ?? []).map((childNavItem) => {
      const grandchild: NavItemWithParent = {
        ...childNavItem,
        parent: navItem,
      };

      return grandchild;
    });

    const parent: NavItemWithParent = navItem;

    return [parent, ...children];
  });

  function idFromNavItem(navItem: NavModelItem) {
    return 'navModelItem.' + (navItem.id ?? navItem.url);
  }

  const navBarActions = flatNavTree
    .map<Action | undefined>((navItem) => {
      const { url, id, text } = navItem ?? {};
      if (!url || !id || !text) {
        return;
      }

      return {
        id: idFromNavItem(navItem),
        name: `Go to ${text}`,
        perform: () => locationService.push(url),
        parent: navItem.parent && idFromNavItem(navItem.parent),
        section: 'Navigation',
      };
    })
    .filter(isTruthy);

  return [...globalActions, ...navBarActions];
};
