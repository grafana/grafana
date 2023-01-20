import { locationUtil, NavModelItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { t } from 'app/core/internationalization';
import { changeTheme } from 'app/core/services/theme';

import { CommandPaletteAction } from '../types';
import { DEFAULT_PRIORITY, PREFERENCES_PRIORITY } from '../values';

// We reuse this, but translations cannot be in module scope (t must be called after i18n has set up,)
const getPagesSectionTranslation = () => t('command-palette.section.pages', 'Pages');

// TODO: Clean this once ID is mandatory on nav items
function idForNavItem(navItem: NavModelItem) {
  return 'navModel.' + navItem.id ?? navItem.url ?? navItem.text ?? navItem.subTitle;
}

function navTreeToActions(navTree: NavModelItem[], parent?: NavModelItem): CommandPaletteAction[] {
  const navActions: CommandPaletteAction[] = [];

  for (const navItem of navTree) {
    const { url, text, isCreateAction, children } = navItem;
    const hasChildren = Boolean(children?.length);

    if (!(url || hasChildren)) {
      continue;
    }

    const section = isCreateAction ? t('command-palette.section.actions', 'Actions') : getPagesSectionTranslation();

    const action = {
      id: idForNavItem(navItem),
      name: text, // TODO: translate
      section: section,
      perform: url ? () => locationService.push(locationUtil.stripBaseFromUrl(url)) : undefined,
      parent: parent && idForNavItem(parent),
      priority: DEFAULT_PRIORITY,
    };

    navActions.push(action);

    if (children?.length) {
      const childActions = navTreeToActions(children, navItem);
      navActions.push(...childActions);
    }
  }

  return navActions;
}

export default (navBarTree: NavModelItem[]): CommandPaletteAction[] => {
  const globalActions: CommandPaletteAction[] = [
    {
      id: 'go/search',
      name: t('command-palette.action.search', 'Search'),
      keywords: 'navigate',
      perform: () => locationService.push('?search=open'),
      section: t('command-palette.section.pages', 'Pages'),
      priority: DEFAULT_PRIORITY,
    },
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
