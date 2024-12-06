import { NavModelItem } from '@grafana/data';
import { enrichHelpItem } from 'app/core/components/AppChrome/MegaMenu/utils';
import { t } from 'app/core/internationalization';
import { changeTheme } from 'app/core/services/theme';

import { CommandPaletteAction } from '../types';
import { ACTIONS_PRIORITY, DEFAULT_PRIORITY, PREFERENCES_PRIORITY } from '../values';

// TODO: Clean this once ID is mandatory on nav items
function idForNavItem(navItem: NavModelItem) {
  return 'navModel.' + navItem.id ?? navItem.url ?? navItem.text ?? navItem.subTitle;
}

const SHORTCUTS = {
  'dashboards/new': ['/', 'd', 'n'],
  'dashboards/import': ['/', 'd', 'i'],
  alert: ['/', 'a', 'r'],
  home: ['/', 'g', 'h'],
  bookmarks: ['/', 'g', 'b'],
  starred: ['/', 'g', 's'],
  'dashboards/browse': ['/', 'g', 'd'],
  explore: ['/', 'g', 'e'],
  'alerts-and-incidents': ['/', 'g', 'i'],
  connections: ['/', 'g', 'c'],
  cfg: ['/', 'g', 'a'],
  profile: ['/', 'g', 'p'],
  help: ['/', '?'],
};

type MappedAction = keyof typeof SHORTCUTS;
type Shortcut = (typeof SHORTCUTS)[MappedAction];
const PREFIX = 'navModel.';

const isMapped = (id: MappedAction | string): id is MappedAction => Object.hasOwnProperty.call(SHORTCUTS, id);

function addShortcut(navId: string): {};
function addShortcut(navId: `${typeof PREFIX}${MappedAction}`): { shortcut: Shortcut };
function addShortcut(navId: `${typeof PREFIX}${MappedAction}` | string): { shortcut: string[] } | {} {
  const id = navId.replace(PREFIX, '');
  if (isMapped(id)) {
    return { shortcut: SHORTCUTS[id] };
  }

  return {};
}

function navTreeToActions(navTree: NavModelItem[], parents: NavModelItem[] = []): CommandPaletteAction[] {
  const navActions: CommandPaletteAction[] = [];

  for (let navItem of navTree) {
    // help node needs enriching with the frontend links
    if (navItem.id === 'help') {
      navItem = enrichHelpItem({ ...navItem });
      delete navItem.url;
    }
    const { url, target, text, isCreateAction, children, onClick, keywords } = navItem;
    const hasChildren = Boolean(children?.length);

    if (!(url || onClick || hasChildren)) {
      continue;
    }

    let urlOrCallback: CommandPaletteAction['url'] = url;
    if (
      url &&
      (navItem.id === 'connections-add-new-connection' ||
        navItem.id === 'standalone-plugin-page-/connections/add-new-connection')
    ) {
      urlOrCallback = (searchQuery: string) => {
        const matchingKeyword = keywords?.find((keyword) => keyword.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchingKeyword ? `${url}?search=${matchingKeyword}` : url;
      };
    }

    const section = isCreateAction
      ? t('command-palette.section.actions', 'Actions')
      : t('command-palette.section.pages', 'Pages');

    const priority = isCreateAction ? ACTIONS_PRIORITY : DEFAULT_PRIORITY;

    const subtitle = parents.map((parent) => parent.text).join(' > ');
    const id = idForNavItem(navItem);
    const action: CommandPaletteAction = {
      id,
      name: text,
      section,
      url: urlOrCallback,
      target,
      parent: parents.length > 0 && !isCreateAction ? idForNavItem(parents[parents.length - 1]) : undefined,
      perform: onClick,
      keywords: keywords?.join(' '),
      priority,
      subtitle: isCreateAction ? undefined : subtitle,
      ...addShortcut(id),
    };

    navActions.push(action);

    if (children?.length) {
      const childActions = navTreeToActions(children, [...parents, navItem]);
      navActions.push(...childActions);
    }
  }

  return navActions;
}

export default (navBarTree: NavModelItem[], extensionActions: CommandPaletteAction[]): CommandPaletteAction[] => {
  const themeSubtitle = t('command-palette.action.change-theme', 'Change theme').replace('...', '');
  const globalActions: CommandPaletteAction[] = [
    {
      id: 'preferences/theme',
      name: t('command-palette.action.change-theme', 'Change theme...'),
      keywords: 'interface color dark light',
      section: t('command-palette.section.preferences', 'Preferences'),
      priority: PREFERENCES_PRIORITY,
      shortcut: ['/', 't', 'c'],
    },
    {
      id: 'preferences/dark-theme',
      name: t('command-palette.action.dark-theme', 'Dark'),
      keywords: 'dark theme',
      perform: () => changeTheme('dark'),
      parent: 'preferences/theme',
      priority: PREFERENCES_PRIORITY,
      section: t('command-palette.section.preferences', 'Preferences'),
      subtitle: themeSubtitle,
      shortcut: ['/', 't', 'd'],
    },
    {
      id: 'preferences/light-theme',
      name: t('command-palette.action.light-theme', 'Light'),
      keywords: 'light theme',
      perform: () => changeTheme('light'),
      parent: 'preferences/theme',
      priority: PREFERENCES_PRIORITY,
      section: t('command-palette.section.preferences', 'Preferences'),
      subtitle: themeSubtitle,
      shortcut: ['/', 't', 'l'],
    },
  ];

  const navBarActions = navTreeToActions(navBarTree);

  return [...globalActions, ...extensionActions, ...navBarActions];
};
