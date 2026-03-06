import { createElement, useMemo } from 'react';

import { NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv, getAppEvents, config, locationService } from '@grafana/runtime';
import { Icon, IconName } from '@grafana/ui';

import { getEnrichedHelpItem } from 'app/core/components/AppChrome/MegaMenu/utils';
import {
  shouldRenderInviteUserButton,
  performInviteUserClick,
} from 'app/core/components/AppChrome/TopBar/InviteUserButtonUtils';
import { changeTheme } from 'app/core/services/theme';
import { currentMockApiState, toggleMockApiAndReload, togglePseudoLocale } from 'app/dev-utils';
import {
  CONTENT_KINDS,
  DashboardLibraryInteractions,
  SOURCE_ENTRY_POINTS,
} from 'app/features/dashboard/dashgrid/DashboardLibrary/interactions';
import { OpenExtensionSidebarEvent } from 'app/types/events';
import { useSelector } from 'app/types/store';

import { CommandPaletteAction } from '../types';
import { DASHBOARDS_PRIORITY, DEFAULT_PRIORITY, PREFERENCES_PRIORITY } from '../values';

const CREATE_ACTION_ICONS: Record<string, IconName> = {
  'dashboards/new': 'plus',
  'alert': 'bell',
  'import': 'import',
  'dashboards/import': 'import',
};

function getCreateActionIcon(id?: string): IconName {
  return (id && CREATE_ACTION_ICONS[id]) || 'apps';
}

// TODO: Clean this once ID is mandatory on nav items
function idForNavItem(navItem: NavModelItem) {
  return 'navModel.' + (navItem.id ?? navItem.url ?? navItem.text ?? navItem.subTitle);
}

function navTreeToActions(navTree: NavModelItem[], parents: NavModelItem[] = []): CommandPaletteAction[] {
  const navActions: CommandPaletteAction[] = [];

  for (let navItem of navTree) {
    if (navItem.id === 'profile' || navItem.id === 'help') {
      continue;
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
      ? t('command-palette.section.dashboards', 'Dashboards')
      : t('command-palette.section.navigation', 'Navigation');

    const priority = isCreateAction ? DASHBOARDS_PRIORITY : DEFAULT_PRIORITY;

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
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      icon: isCreateAction
        ? createElement(Icon, { name: getCreateActionIcon(navItem.id) })
        : navItem.icon
          ? createElement(Icon, { name: navItem.icon as IconName })
          : undefined,
    };

    navActions.push(action);

    if (children?.length) {
      const childActions = navTreeToActions(children, [...parents, navItem]);
      navActions.push(...childActions);
    }
  }

  return navActions;
}

function getGlobalActions(profileNode?: NavModelItem, helpNode?: NavModelItem): CommandPaletteAction[] {
  const section = t('command-palette.section.global', 'Global');
  const actions: CommandPaletteAction[] = [];

  if (profileNode?.children) {
    for (const child of profileNode.children) {
      if (child.url) {
        actions.push({
          id: `global/${child.id ?? child.url}`,
          name: child.text,
          section,
          priority: PREFERENCES_PRIORITY,
          url: child.url,
          target: child.target,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          icon: child.icon ? createElement(Icon, { name: child.icon as IconName }) : undefined,
        });
      }
    }
  }

  actions.push(
    {
      id: 'preferences/theme',
      name: t('command-palette.action.change-theme', 'Change theme'),
      keywords: 'interface color dark light',
      section,
      priority: PREFERENCES_PRIORITY,
      icon: createElement(Icon, { name: 'palette' }),
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
    {
      id: 'global/kiosk-mode',
      name: t('profile.enable-kiosk-mode', 'Enable kiosk mode'),
      keywords: 'kiosk fullscreen presentation',
      section,
      priority: PREFERENCES_PRIORITY,
      icon: createElement(Icon, { name: 'monitor' }),
      perform: () => {
        locationService.partial({ kiosk: true });
      },
    }
  );

  if (helpNode) {
    const enrichedHelp = getEnrichedHelpItem({ ...helpNode });
    actions.push({
      id: 'global/help',
      name: enrichedHelp.text,
      section,
      priority: PREFERENCES_PRIORITY,
      keywords: 'help support documentation community',
      icon: createElement(Icon, { name: 'question-circle' }),
    });

    actions.push({
      id: 'global/help/interactive-learning',
      name: t('command-palette.action.open-interactive-learning', 'Open interactive learning'),
      priority: PREFERENCES_PRIORITY,
      parent: 'global/help',
      icon: createElement(Icon, { name: 'book-open' }),
      perform: () => {
        const appEvents = getAppEvents();
        appEvents.publish(
          new OpenExtensionSidebarEvent({
            pluginId: 'grafana-pathfinder-app',
            componentTitle: 'Interactive learning',
          })
        );
      },
    });

    if (enrichedHelp.children) {
      for (const child of enrichedHelp.children) {
        actions.push({
          id: `global/help/${child.id ?? child.url ?? child.text}`,
          name: child.text,
          priority: PREFERENCES_PRIORITY,
          parent: 'global/help',
          url: child.url,
          target: child.target,
          perform: child.onClick,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          icon: child.icon ? createElement(Icon, { name: child.icon as IconName }) : undefined,
        });
      }
    }
  }

  if (!config.auth.disableSignoutMenu) {
    actions.push({
      id: 'global/sign-out',
      name: t('nav.sign-out.title', 'Sign out'),
      keywords: 'sign out logout',
      section,
      priority: PREFERENCES_PRIORITY,
      icon: createElement(Icon, { name: 'arrow-from-right' }),
      url: `${config.appSubUrl}/logout`,
      target: '_self',
    });
  }

  if (process.env.NODE_ENV === 'development') {
    // eslint-disable @grafana/i18n/no-untranslated-strings
    const currentState = currentMockApiState();
    const mockApiAction = currentState ? 'Disable' : 'Enable';
    actions.push({
      id: 'preferences/dev/toggle-mock-api',
      section,
      name: `${mockApiAction} Mock API worker and reload`,
      subtitle: 'Intercepts requests and returns mock data using MSW',
      keywords: 'mock api',
      priority: PREFERENCES_PRIORITY,
      perform: toggleMockApiAndReload,
    });

    actions.push({
      id: 'preferences/dev/pseudo-locale',
      section,
      name: 'Toggle pseudo locale',
      subtitle: 'Toggles between default language and pseudo locale',
      keywords: 'pseudo locale',
      priority: PREFERENCES_PRIORITY,
      perform: () => {
        togglePseudoLocale();
      },
    });
    // eslint-enable @grafana/i18n/no-untranslated-strings
  }

  return actions;
}

export function useStaticActions(): CommandPaletteAction[] {
  const navBarTree = useSelector((state) => state.navBarTree);
  const profileNode = useSelector((state) => state.navIndex['profile']);
  const helpNode = navBarTree.find((item) => item.id === 'help');
  return useMemo(() => {
    let navBarActions = navTreeToActions(navBarTree);

    if (config.featureToggles.dashboardTemplates) {
      const testDataSources = getDataSourceSrv().getList({ type: 'grafana-testdata-datasource' });
      if (testDataSources.length > 0) {
        const navBarActionsWithoutActions = navBarActions.filter((action) => action.priority !== DASHBOARDS_PRIORITY);
        const navBarActionsWithActions = navBarActions.filter((action) => action.priority === DASHBOARDS_PRIORITY);

        navBarActionsWithActions.splice(1, 0, {
          id: 'browse-template-dashboard',
          name: t('command-palette.action.dashboard-from-template', 'Dashboard from template'),
          section: t('command-palette.section.dashboards', 'Dashboards'),
          priority: DASHBOARDS_PRIORITY,
          icon: createElement(Icon, { name: 'copy' }),
          perform: () => {
            DashboardLibraryInteractions.entryPointClicked({
              entryPoint: SOURCE_ENTRY_POINTS.COMMAND_PALETTE,
              contentKind: CONTENT_KINDS.TEMPLATE_DASHBOARD,
            });
            locationService.push('/dashboards?templateDashboards=true&source=commandPalette');
          },
        });

        navBarActions = [...navBarActionsWithoutActions, ...navBarActionsWithActions];
      }
    }

    if (shouldRenderInviteUserButton()) {
      navBarActions.push({
        id: 'invite-user',
        name: t('navigation.invite-user.invite-new-user-button', 'Invite new user'),
        section: t('command-palette.section.dashboards', 'Dashboards'),
        priority: DASHBOARDS_PRIORITY,
        icon: createElement(Icon, { name: 'users-alt' }),
        perform: () => {
          performInviteUserClick('command_palette_actions', 'invite-user-command-palette');
        },
      });
    }
    return [...getGlobalActions(profileNode, helpNode), ...navBarActions];
  }, [navBarTree, profileNode, helpNode]);
}
