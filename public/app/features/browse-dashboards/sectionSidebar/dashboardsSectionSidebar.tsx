import { useState } from 'react';
import { useAsync } from 'react-use';

import { t } from '@grafana/i18n';
import { useGetFolderQueryFacade } from 'app/api/clients/folder/v1beta1/hooks';
import { createNavMoreGroup } from 'app/core/components/AppChrome/SectionSidebar/navChildrenGroup';
import { registerSectionSidebar } from 'app/core/components/AppChrome/SectionSidebar/registry';
import {
  type SectionSidebarContext,
  type SectionSidebarDefinition,
  type SectionSidebarNewActions,
  type SectionSidebarSearchResults,
} from 'app/core/components/AppChrome/SectionSidebar/types';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { queryResultToViewItem } from 'app/features/search/service/utils';

import { NewFolderDrawer, useCreateNewActions } from '../components/CreateNewMenu';
import { getFolderPermissions } from '../permissions';

import { toTreeNode } from './api';
import { FoldersGroup, getDashboardsPageContext, RecentGroup, StarredGroup } from './groups';

function useDashboardsNewActions(context: SectionSidebarContext): SectionSidebarNewActions {
  const { folderUid } = getDashboardsPageContext(context);
  const [showNewFolderDrawer, setShowNewFolderDrawer] = useState(false);
  // The root folder carries the permissions for creating at the top level
  const { data: folder } = useGetFolderQueryFacade(folderUid ?? 'general');
  const parentFolder = folderUid ? folder : undefined;
  const { canCreateDashboards, canCreateFolders } = getFolderPermissions(folder);

  const actions = useCreateNewActions({
    parentFolder,
    canCreateDashboard: canCreateDashboards,
    canCreateFolder: canCreateFolders,
    onNewFolder: () => setShowNewFolderDrawer(true),
  });

  return {
    actions: actions.map(({ id, label, icon, url, onClick }) => ({ id, label, icon, url, onClick })),
    element: showNewFolderDrawer && (
      <NewFolderDrawer parentFolder={parentFolder} onClose={() => setShowNewFolderDrawer(false)} />
    ),
  };
}

const SEARCH_LIMIT = 50;

function useDashboardsSearchResults({ query }: { query: string }): SectionSidebarSearchResults {
  const { value, loading, error } = useAsync(async () => {
    if (!query.trim()) {
      return [];
    }
    const { view } = await getGrafanaSearcher().search({ query, kind: ['dashboard', 'folder'], limit: SEARCH_LIMIT });
    return view.flatMap((item) => {
      const viewItem = queryResultToViewItem(item, view);
      const node = toTreeNode(viewItem);
      return node ? [{ ...node, subtitle: viewItem.parentTitle }] : [];
    });
  }, [query]);

  return { items: value ?? [], loading, error };
}

export function getDashboardsSectionSidebar(): SectionSidebarDefinition {
  return {
    id: 'dashboards',
    title: t('browse-dashboards.section-sidebar.title', 'Dashboards'),
    icon: 'apps',
    // Every dashboards page sits under the browse nav node. The browse list itself opts out.
    navIds: ['dashboards/browse'],
    useNewActions: useDashboardsNewActions,
    search: {
      placeholder: t('browse-dashboards.section-sidebar.search', 'Search dashboards'),
      useResults: useDashboardsSearchResults,
    },
    groups: [
      createNavMoreGroup({
        id: 'pages',
        title: t('browse-dashboards.section-sidebar.pages', 'Dashboards pages'),
        navId: 'dashboards/browse',
        primaryTitle: t('browse-dashboards.section-sidebar.browse', 'Browse dashboards'),
        primaryIcon: 'apps',
        dividerAfter: true,
      }),
      {
        id: 'starred',
        title: t('browse-dashboards.section-sidebar.starred', 'Starred'),
        Component: StarredGroup,
      },
      {
        id: 'recent',
        title: t('browse-dashboards.section-sidebar.recent', 'Recent'),
        Component: RecentGroup,
        dividerAfter: true,
      },
      {
        id: 'folders',
        title: t('browse-dashboards.section-sidebar.folders', 'Folders'),
        Component: FoldersGroup,
      },
    ],
  };
}

export function initDashboardsSectionSidebar() {
  registerSectionSidebar(getDashboardsSectionSidebar());
}
