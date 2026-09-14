import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useEffect, useMemo } from 'react';

import { fuzzySearch, type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, locationService } from '@grafana/runtime';
import { useFlagGrafanaCustomDashboardTemplates } from '@grafana/runtime/internal';
import { getEnrichedHelpItem } from 'app/core/components/AppChrome/MegaMenu/utils';
import {
  performInviteUserClick,
  shouldRenderInviteUserButton,
} from 'app/core/components/AppChrome/TopBar/InviteUserButtonUtils';
import { contextSrv } from 'app/core/services/context_srv';
import { changeTheme } from 'app/core/services/theme';
import { currentMockApiState, toggleMockApiAndReload, togglePseudoLocale } from 'app/dev-utils';
import { NewDashboardLibraryInteractions } from 'app/features/dashboard/dashgrid/DashboardLibrary/analytics/main';
import { CONTENT_KINDS, SOURCE_ENTRY_POINTS } from 'app/features/dashboard/dashgrid/DashboardLibrary/constants';
import { useTemplateDashboardsAvailability } from 'app/features/dashboard/dashgrid/DashboardLibrary/hooks/useTemplateDashboardsAvailability';
import { DashboardLibraryInteractions } from 'app/features/dashboard/dashgrid/DashboardLibrary/interactions';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';
import { AccessControlAction } from 'app/types/accessControl';
import { useSelector } from 'app/types/store';

import { registerCmdkSource } from '../registry';
import { type CmdkItem, type CmdkSection, type CmdkSource } from '../types';

export const ACTIONS_PRIORITY = 5;
export const DEFAULT_PRIORITY = 4;
export const PREFERENCES_PRIORITY = 3;

// Section ids match the old palette's sectionId slugs (see commandPalette/values.ts) so analytics stay comparable.
export const SECTION_ACTIONS = 'actions';
export const SECTION_PAGES = 'pages';
export const SECTION_PREFERENCES = 'preferences';
export const SECTION_DEV_TOOLING = 'dev-tooling';

/**
 * An item plus the metadata the source needs for its own filtering. Only topLevel entries show for the empty
 * query (like kbar showing only root actions); everything is searchable once the user types.
 */
export interface StaticEntry {
  item: CmdkItem;
  searchText: string;
  topLevel: boolean;
  // For items whose destination depends on the current query (add-new-connection deep links).
  hrefForQuery?: (query: string) => string;
}

export function filterStaticEntries(entries: StaticEntry[], query: string): CmdkItem[] {
  if (query === '') {
    return entries.filter((entry) => entry.topLevel).map((entry) => entryToItem(entry, query));
  }
  const matches = fuzzySearch(
    entries.map((entry) => entry.searchText),
    query
  );
  return matches.map((index) => entryToItem(entries[index], query));
}

function entryToItem(entry: StaticEntry, query: string): CmdkItem {
  if (entry.hrefForQuery && entry.item.type === 'navigation') {
    return { ...entry.item, href: entry.hrefForQuery(query) };
  }
  return entry.item;
}

// TODO: Clean this once ID is mandatory on nav items
function idForNavItem(navItem: NavModelItem) {
  return 'navModel.' + (navItem.id ?? navItem.url ?? navItem.text ?? navItem.subTitle);
}

export function navTreeToEntries(navTree: NavModelItem[], parents: NavModelItem[] = []): StaticEntry[] {
  const entries: StaticEntry[] = [];

  for (let navItem of navTree) {
    // help node needs enriching with the frontend links
    if (navItem.id === 'help') {
      navItem = getEnrichedHelpItem({ ...navItem });
      delete navItem.url;
    }
    const { url, target, text, isCreateAction, children, onClick, keywords } = navItem;
    const hasChildren = Boolean(children?.length);

    if (!(url || onClick || hasChildren)) {
      continue;
    }

    let hrefForQuery: StaticEntry['hrefForQuery'];
    if (
      url &&
      (navItem.id === 'connections-add-new-connection' ||
        navItem.id === 'standalone-plugin-page-/connections/add-new-connection')
    ) {
      hrefForQuery = (searchQuery: string) => {
        const matchingKeyword = keywords?.find((keyword) => keyword.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchingKeyword ? `${url}?search=${matchingKeyword}` : url;
      };
    }

    const parentPath = parents.map((parent) => parent.text).join(' > ');
    const base = {
      id: idForNavItem(navItem),
      sectionId: isCreateAction ? SECTION_ACTIONS : SECTION_PAGES,
      title: text,
      priority: isCreateAction ? ACTIONS_PRIORITY : DEFAULT_PRIORITY,
      subtitle: !isCreateAction && parents.length > 0 ? parentPath : undefined,
    };

    const scopedNavItem = navItem;
    // Items that navigate on select but also have children (like Drilldown apps) get an extra action to dive
    // into a subscope listing those children instead of navigating.
    const browseChildrenActions: CmdkItem['additionalActions'] = hasChildren
      ? [
          {
            type: 'subscope',
            title: t('cmdk.action.browse-children', 'Browse'),
            shortcut: 'shift+enter',
            getScope: () => createNavItemScope(scopedNavItem),
          },
        ]
      : undefined;

    let item: CmdkItem;
    if (url) {
      item = { ...base, type: 'navigation', href: url, target, additionalActions: browseChildrenActions };
    } else if (onClick) {
      item = { ...base, type: 'action', action: onClick, additionalActions: browseChildrenActions };
    } else {
      // A node with only children (like Help) becomes a subscope the user can dive into.
      item = { ...base, type: 'subscope', getScope: () => createNavItemScope(scopedNavItem) };
    }

    entries.push({
      item,
      searchText: [text, keywords?.join(' '), parentPath].filter(Boolean).join(' '),
      // Create actions are shown for the empty query regardless of their depth in the nav tree, like the old
      // palette which never gave them a kbar parent.
      topLevel: parents.length === 0 || Boolean(isCreateAction),
      hrefForQuery,
    });

    if (children?.length) {
      entries.push(...navTreeToEntries(children, [...parents, navItem]));
    }
  }

  return entries;
}

function createNavItemScope(navItem: NavModelItem): CmdkSource {
  const entries = navTreeToEntries(navItem.children ?? []);
  return {
    subscopeName: navItem.text,
    providedSections: sectionsForEntries(entries),
    query: async (query) => filterStaticEntries(entries, query),
  };
}

function getStaticSections(): CmdkSection[] {
  const sections: CmdkSection[] = [
    { id: SECTION_ACTIONS, title: t('command-palette.section.actions', 'Actions') },
    { id: SECTION_PAGES, title: t('command-palette.section.pages', 'Pages') },
    { id: SECTION_PREFERENCES, title: t('command-palette.section.preferences', 'Preferences') },
  ];
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line @grafana/i18n/no-untranslated-strings -- dev only section
    sections.push({ id: SECTION_DEV_TOOLING, title: 'Dev tooling' });
  }
  return sections;
}

function sectionsForEntries(entries: StaticEntry[]): CmdkSection[] {
  return getStaticSections().filter((section) => entries.some((entry) => entry.item.sectionId === section.id));
}

// Dark/Light live in the theme subscope for the empty query, but are also searchable from the root (topLevel
// false), like kbar surfacing child actions on search.
function themeEntries(topLevel: boolean): StaticEntry[] {
  const items: Array<{ id: string; title: string; theme: 'dark' | 'light' }> = [
    { id: 'preferences/dark-theme', title: t('command-palette.action.dark-theme', 'Dark'), theme: 'dark' },
    { id: 'preferences/light-theme', title: t('command-palette.action.light-theme', 'Light'), theme: 'light' },
  ];
  return items.map(({ id, title, theme }) => ({
    item: {
      type: 'action',
      id,
      sectionId: SECTION_PREFERENCES,
      title,
      priority: PREFERENCES_PRIORITY,
      action: () => changeTheme(theme),
    },
    searchText: `${title} ${theme} theme`,
    topLevel,
  }));
}

function createThemeScope(): CmdkSource {
  const entries = themeEntries(true);
  return {
    subscopeName: t('command-palette.action.change-theme', 'Change theme'),
    providedSections: [{ id: SECTION_PREFERENCES, title: t('command-palette.section.preferences', 'Preferences') }],
    query: async (query) => filterStaticEntries(entries, query),
  };
}

function getGlobalEntries(): StaticEntry[] {
  const changeThemeTitle = t('command-palette.action.change-theme', 'Change theme');
  const entries: StaticEntry[] = [
    {
      item: {
        type: 'subscope',
        id: 'preferences/theme',
        sectionId: SECTION_PREFERENCES,
        title: changeThemeTitle,
        priority: PREFERENCES_PRIORITY,
        getScope: createThemeScope,
      },
      searchText: `${changeThemeTitle} interface color dark light`,
      topLevel: true,
    },
    ...themeEntries(false),
  ];

  if (process.env.NODE_ENV === 'development') {
    /* eslint-disable @grafana/i18n/no-untranslated-strings -- dev only actions */
    const mockApiAction = currentMockApiState() ? 'Disable' : 'Enable';
    entries.push({
      item: {
        type: 'action',
        id: 'preferences/dev/toggle-mock-api',
        sectionId: SECTION_DEV_TOOLING,
        title: `${mockApiAction} Mock API worker and reload`,
        subtitle: 'Intercepts requests and returns mock data using MSW',
        priority: PREFERENCES_PRIORITY,
        action: toggleMockApiAndReload,
      },
      searchText: 'mock api',
      topLevel: true,
    });
    entries.push({
      item: {
        type: 'action',
        id: 'preferences/dev/pseudo-locale',
        sectionId: SECTION_DEV_TOOLING,
        title: 'Toggle pseudo locale',
        subtitle: 'Toggles between default language and pseudo locale',
        priority: PREFERENCES_PRIORITY,
        action: () => {
          togglePseudoLocale();
        },
      },
      searchText: 'pseudo locale',
      topLevel: true,
    });
    /* eslint-enable @grafana/i18n/no-untranslated-strings */
  }

  return entries;
}

function actionEntry(id: string, title: string, action: () => void): StaticEntry {
  return {
    item: { type: 'action', id, sectionId: SECTION_ACTIONS, title, priority: ACTIONS_PRIORITY, action },
    searchText: title,
    topLevel: true,
  };
}

/**
 * Port of the old palette's useStaticActions: navigation tree, theme preferences and a few conditional actions.
 * Extension links are intentionally not included; they keep working in the old palette and get their own source
 * later.
 */
function useStaticEntries(): StaticEntry[] {
  const navBarTree = useSelector((state) => state.navBarTree);
  const isAnalyticsFrameworkEnabled = useBooleanFlagValue('analyticsFramework', true);
  const isCustomDashboardTemplatesEnabled = useFlagGrafanaCustomDashboardTemplates();
  const { isAvailable: isTemplateDashboardsAvailable } = useTemplateDashboardsAvailability();
  const { queryLibraryEnabled, openDrawer } = useQueryLibraryContext();

  return useMemo(() => {
    let navEntries = navTreeToEntries(navBarTree);

    const canCreateDashboard = contextSrv.hasPermission(AccessControlAction.DashboardsCreate);
    if (isTemplateDashboardsAvailable && canCreateDashboard) {
      const templateEntry = actionEntry(
        'browse-template-dashboard',
        t('command-palette.action.dashboard-from-template', 'Dashboard from template'),
        () => {
          const interactionPayload = {
            entryPoint: SOURCE_ENTRY_POINTS.COMMAND_PALETTE,
            contentKind: isCustomDashboardTemplatesEnabled ? undefined : CONTENT_KINDS.TEMPLATE_DASHBOARD,
            contentKinds: isCustomDashboardTemplatesEnabled
              ? [CONTENT_KINDS.CUSTOM_DASHBOARD_TEMPLATE, CONTENT_KINDS.TEMPLATE_DASHBOARD]
              : [CONTENT_KINDS.TEMPLATE_DASHBOARD],
          };
          isAnalyticsFrameworkEnabled
            ? NewDashboardLibraryInteractions.entryPointClicked(interactionPayload)
            : DashboardLibraryInteractions.entryPointClicked(interactionPayload);
          locationService.push('/dashboards?templateDashboards=true&source=commandPalette');
        }
      );
      // Keep the old palette's placement: second position among the create actions.
      const withoutActions = navEntries.filter((entry) => entry.item.sectionId !== SECTION_ACTIONS);
      const withActions = navEntries.filter((entry) => entry.item.sectionId === SECTION_ACTIONS);
      withActions.splice(1, 0, templateEntry);
      navEntries = [...withoutActions, ...withActions];
    }

    if (shouldRenderInviteUserButton()) {
      navEntries.push(
        actionEntry('invite-user', t('navigation.invite-user.invite-new-user-button', 'Invite new user'), () => {
          performInviteUserClick('command_palette_actions', 'invite-user-command-palette');
        })
      );
    }

    const canReadQueries = config.featureToggles.savedQueriesRBAC
      ? contextSrv.hasPermission(AccessControlAction.QueriesRead)
      : contextSrv.isSignedIn;
    if (queryLibraryEnabled && canReadQueries) {
      navEntries.push(
        actionEntry('open-saved-queries', t('command-palette.action.open-saved-queries', 'Open saved queries'), () =>
          openDrawer({ options: { context: 'command-palette' } })
        )
      );
    }

    return [...getGlobalEntries(), ...navEntries];
  }, [
    isAnalyticsFrameworkEnabled,
    isCustomDashboardTemplatesEnabled,
    isTemplateDashboardsAvailable,
    navBarTree,
    queryLibraryEnabled,
    openDrawer,
  ]);
}

export function createStaticActionsSource(entries: StaticEntry[]): CmdkSource {
  return {
    providedSections: getStaticSections(),
    query: async (query) => filterStaticEntries(entries, query),
  };
}

/**
 * Builds the static actions source from React state (nav tree, feature flags, contexts) and keeps it registered,
 * re-registering when the underlying data changes.
 */
export function useRegisterStaticActionsSource() {
  const entries = useStaticEntries();

  useEffect(() => {
    return registerCmdkSource(createStaticActionsSource(entries));
  }, [entries]);
}
