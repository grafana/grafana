import { locationUtil, NavModelItem } from '@grafana/data';
import { t } from 'app/core/internationalization';
import { changeTheme } from 'app/core/services/theme';

import { CommandPaletteAction } from '../types';
import { ACTIONS_PRIORITY, DEFAULT_PRIORITY, PREFERENCES_PRIORITY } from '../values';

// TODO: Clean this once ID is mandatory on nav items
function idForNavItem(navItem: NavModelItem) {
  return 'navModel.' + navItem.id ?? navItem.url ?? navItem.text ?? navItem.subTitle;
}

function navTreeToActions(navTree: NavModelItem[], parents: NavModelItem[] = []): CommandPaletteAction[] {
  const navActions: CommandPaletteAction[] = [];

  for (const navItem of navTree) {
    const { url, target, text, isCreateAction, children } = navItem;
    const hasChildren = Boolean(children?.length);

    if (!(url || hasChildren)) {
      continue;
    }

    const section = isCreateAction
      ? t('command-palette.section.actions', 'Actions')
      : t('command-palette.section.pages', 'Pages');

    const priority = isCreateAction ? ACTIONS_PRIORITY : DEFAULT_PRIORITY;

    const subtitle = parents.map((parent) => parent.text).join(' > ');
    const action = {
      id: idForNavItem(navItem),
      name: text,
      section: section,
      url: url && locationUtil.stripBaseFromUrl(url),
      target,
      parent: parents.length > 0 && !isCreateAction ? idForNavItem(parents[parents.length - 1]) : undefined,
      priority: priority,
      subtitle: isCreateAction ? undefined : subtitle,
    };

    navActions.push(action);

    if (children?.length) {
      const childActions = navTreeToActions(children, [...parents, navItem]);
      navActions.push(...childActions);
    }
  }

  return navActions;
}

export default (navBarTree: NavModelItem[]): CommandPaletteAction[] => {
  const globalActions: CommandPaletteAction[] = [
    {
      id: 'preferences/theme',
      name: t('command-palette.action.change-theme', 'Change theme...'),
      keywords: 'interface color dark light',
      section: t('command-palette.section.preferences', 'Preferences'),
      priority: PREFERENCES_PRIORITY,
    },
    {
      id: 'preferences/dark-theme',
      name: t('command-palette.action.dark-theme', 'Dark'),
      keywords: 'dark theme',
      perform: () => changeTheme('dark'),
      parent: 'preferences/theme',
      priority: PREFERENCES_PRIORITY,
    },
    {
      id: 'preferences/light-theme',
      name: t('command-palette.action.light-theme', 'Light'),
      keywords: 'light theme',
      perform: () => changeTheme('light'),
      parent: 'preferences/theme',
      priority: PREFERENCES_PRIORITY,
    },
  ];

  const navBarActions = navTreeToActions(navBarTree);

  return [...globalActions, ...navBarActions];
};
