import { useMemo } from 'react';

import { NavModelItem } from '@grafana/data';
import { enrichHelpItem } from 'app/core/components/AppChrome/MegaMenu/utils';
import { performInviteUserClick, shouldRenderInviteUserButton } from 'app/core/components/InviteUserButton/utils';
import { t } from 'app/core/internationalization';
import { changeTheme } from 'app/core/services/theme';

import { useSelector } from '../../../types';
import { CommandPaletteAction } from '../types';
import { ACTIONS_PRIORITY, DEFAULT_PRIORITY, PREFERENCES_PRIORITY } from '../values';

// TODO: Clean this once ID is mandatory on nav items
function idForNavItem(navItem: NavModelItem) {
  return 'navModel.' + (navItem.id ?? navItem.url ?? navItem.text ?? navItem.subTitle);
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
    const action: CommandPaletteAction = {
      id: idForNavItem(navItem),
      name: text,
      section,
      url: urlOrCallback,
      target,
      parent: parents.length > 0 && !isCreateAction ? idForNavItem(parents[parents.length - 1]) : undefined,
      perform: onClick,
      keywords: keywords?.join(' '),
      priority,
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

function getGlobalActions(): CommandPaletteAction[] {
  return [
    {
      id: 'preferences/theme',
      name: t('command-palette.action.change-theme', 'Change theme'),
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
}

export function useStaticActions(): CommandPaletteAction[] {
  const navBarTree = useSelector((state) => state.navBarTree);
  return useMemo(() => {
    const navBarActions = navTreeToActions(navBarTree);

    if (shouldRenderInviteUserButton) {
      navBarActions.push({
        id: 'invite-user',
        name: t('navigation.invite-user.invite-new-member-button', 'Invite new member'),
        section: t('command-palette.section.actions', 'Actions'),
        priority: ACTIONS_PRIORITY,
        perform: () => {
          performInviteUserClick('command_palette_actions', 'invite-user-command-palette');
        },
      });
    }
    return [...getGlobalActions(), ...navBarActions];
  }, [navBarTree]);
}
