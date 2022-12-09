import { Action, Priority } from 'kbar';
import React from 'react';

import { isIconName, locationUtil, NavModelItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Icon } from '@grafana/ui';
import { changeTheme } from 'app/core/services/theme';

const SECTION_PAGES = 'Pages';
const SECTION_ACTIONS = 'Actions';
const SECTION_PREFERENCES = 'Preferences';

export interface NavBarActions {
  url: string;
  actions: Action[];
}

// TODO: Clean this once ID is mandatory on nav items
function idForNavItem(navItem: NavModelItem) {
  return 'navModel.' + navItem.id ?? navItem.url ?? navItem.text ?? navItem.subTitle;
}

function navTreeToActions(navTree: NavModelItem[], parent?: NavModelItem): Action[] {
  const navActions: Action[] = [];

  for (const navItem of navTree) {
    const { url, text, isCreateAction, children } = navItem;
    const hasChildren = Boolean(children?.length);

    if (!(url || hasChildren)) {
      continue;
    }

    const action: Action = {
      id: idForNavItem(navItem),
      name: text, // TODO: translate
      section: isCreateAction ? SECTION_ACTIONS : SECTION_PAGES,
      perform: url ? () => locationService.push(locationUtil.stripBaseFromUrl(url)) : undefined,
      parent: parent && idForNavItem(parent),

      // Only show icons for top level items
      icon: !parent && iconForNavItem(navItem),
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
      icon: <Icon name="search" size="md" />,
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

  const navBarActions = navTreeToActions(navBarTree);

  return [...globalActions, ...navBarActions];
};

function iconForNavItem(navItem: NavModelItem) {
  if (navItem.icon && isIconName(navItem.icon)) {
    return <Icon name={navItem.icon} size="md" />;
  } else if (navItem.img) {
    return <img alt="" src={navItem.img} style={{ width: 16, height: 16 }} />;
  }

  return undefined;
}
