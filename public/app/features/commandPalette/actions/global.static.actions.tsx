import { Action, Priority } from 'kbar';
import React from 'react';

import { isIconName, NavModelItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Icon } from '@grafana/ui';

const SECTION_PAGES = 'Pages';
const SECTION_ACTIONS = 'Actions';
const SECTION_PREFERENCES = 'Preferences';

export interface NavBarActions {
  url: string;
  actions: Action[];
}

// TODO: crappy hacky, make this better. make ids mandatory on nav items?
function idForNavItem(navItem: NavModelItem) {
  return 'navModel.' + navItem.id ?? navItem.url ?? navItem.text ?? navItem.subTitle;
}

function navTreeToActions(navTree: NavModelItem[], parent?: NavModelItem): Action[] {
  const navActions: Action[] = [];

  for (const navItem of navTree) {
    const { url, text, isCreateAction, children, icon } = navItem;
    const hasChildren = Boolean(children?.length);

    if (!(url || hasChildren)) {
      continue;
    }

    const hasPerform = url && !hasChildren;

    const action: Action = {
      id: idForNavItem(navItem),
      name: text, // TODO: translate
      section: isCreateAction ? SECTION_ACTIONS : SECTION_PAGES,
      parent: parent && idForNavItem(parent),
      perform: hasPerform ? () => locationService.push(url) : undefined,
      icon: !parent && isIconName(icon) && <Icon name={icon} size="md" />,
    };

    navActions.push(action);

    if (children?.length) {
      const childActions = navTreeToActions(children, navItem);
      navActions.push(...childActions);
    }
  }

  return navActions;
}

export default (navBarTree: NavModelItem[]) => {
  const globalActions: Action[] = [
    {
      // TODO: Figure out what section, if any, to put this in
      id: 'go/dashboard',
      name: 'Dashboards...',
      keywords: 'navigate',
      priority: Priority.NORMAL,
    },
    {
      id: 'go/search',
      name: 'Search',
      keywords: 'navigate',
      perform: () => locationService.push('?search=open'),
      section: SECTION_PAGES,
      shortcut: ['s', 'o'],
    },
    {
      id: 'preferences/theme',
      name: 'Change theme...',
      keywords: 'interface color dark light',
      section: SECTION_PREFERENCES,
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

  const navBarActions = navTreeToActions(navBarTree);

  return [...globalActions, ...navBarActions];
};
