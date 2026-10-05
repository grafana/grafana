import { useCallback, useEffect, useRef, useState } from 'react';
import { useAsync } from 'react-use';

import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { t } from '@grafana/i18n';
import { Spinner } from '@grafana/ui';
import {
  SectionSidebarGroup,
  SectionSidebarItem,
  SectionSidebarTree,
  useSectionSidebarExpanded,
} from 'app/core/components/AppChrome/SectionSidebar/primitives';
import { type SectionSidebarContext } from 'app/core/components/AppChrome/SectionSidebar/types';
import { useDashboardLocationInfo } from 'app/features/search/hooks/useDashboardLocationInfo';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { queryResultToViewItem } from 'app/features/search/service/utils';
import { useStarredItems } from 'app/features/stars/hooks';

import { getRecentlyViewedDashboards } from '../api/recentlyViewed';

import { type DashboardsTreeNode, loadFolderChildren, loadRootFolders } from './api';

const MAX_RECENT = 10;

export interface DashboardsPageContext {
  folderUid?: string;
  dashboardUid?: string;
}

export function getDashboardsPageContext({ pageContext }: SectionSidebarContext): DashboardsPageContext {
  return {
    folderUid: typeof pageContext.folderUid === 'string' && pageContext.folderUid ? pageContext.folderUid : undefined,
    dashboardUid: typeof pageContext.dashboardUid === 'string' ? pageContext.dashboardUid : undefined,
  };
}

const loadNodeChildren = (node: DashboardsTreeNode) => loadFolderChildren(node.id);

export function StarredGroup(context: SectionSidebarContext) {
  const [expanded, setExpanded] = useSectionSidebarExpanded('dashboards.starred');
  const { dashboardUid } = getDashboardsPageContext(context);
  const { data: starredUids } = useStarredItems(DASHBOARD_API_GROUP, 'Dashboard', { skip: !expanded });
  // Keyed by value, so a new array with the same stars doesn't refetch
  const starredKey = starredUids?.join(',');

  const { value: dashboards, loading } = useAsync(async () => {
    if (!starredUids?.length) {
      return [];
    }
    const { view } = await getGrafanaSearcher().search({
      kind: ['dashboard'],
      uid: starredUids,
      limit: starredUids.length,
    });
    return view.map((item) => queryResultToViewItem(item, view));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starredKey]);

  return (
    <SectionSidebarGroup id="starred">
      <SectionSidebarItem
        title={t('browse-dashboards.section-sidebar.starred', 'Starred')}
        icon="star"
        expandable
        expanded={expanded}
        loading={expanded && (loading || !starredUids)}
        onToggle={() => setExpanded(!expanded)}
      >
        {dashboards?.length === 0 && (
          <SectionSidebarItem
            level={1}
            title={t('browse-dashboards.section-sidebar.starred-empty', 'No starred dashboards yet')}
          />
        )}
        {dashboards?.map((dashboard) => (
          <SectionSidebarItem
            key={dashboard.uid}
            level={1}
            title={dashboard.title}
            icon="apps"
            url={dashboard.url}
            subtitle={dashboard.parentTitle}
            active={dashboard.uid === dashboardUid}
          />
        ))}
      </SectionSidebarItem>
    </SectionSidebarGroup>
  );
}

export function RecentGroup(context: SectionSidebarContext) {
  const { dashboardUid } = getDashboardsPageContext(context);
  const [expanded, setExpanded] = useSectionSidebarExpanded('dashboards.recent');
  const { value: recentDashboards, loading } = useAsync(
    async () => (expanded ? getRecentlyViewedDashboards(MAX_RECENT) : undefined),
    [expanded]
  );
  const { foldersByUid } = useDashboardLocationInfo(Boolean(recentDashboards?.length));

  return (
    <SectionSidebarGroup id="recent">
      <SectionSidebarItem
        title={t('browse-dashboards.section-sidebar.recent', 'Recent')}
        icon="history"
        expandable
        expanded={expanded}
        loading={loading}
        onToggle={() => setExpanded(!expanded)}
      >
        {recentDashboards?.length === 0 && (
          <SectionSidebarItem
            level={1}
            title={t('browse-dashboards.section-sidebar.recent-empty', 'No recently viewed dashboards')}
          />
        )}
        {recentDashboards?.map((dashboard) => (
          <SectionSidebarItem
            key={dashboard.uid}
            level={1}
            title={dashboard.name}
            icon="apps"
            url={dashboard.url}
            subtitle={foldersByUid[dashboard.location]?.name}
            active={dashboard.uid === dashboardUid}
          />
        ))}
      </SectionSidebarItem>
    </SectionSidebarGroup>
  );
}

export function FoldersGroup(context: SectionSidebarContext) {
  const { folderUid, dashboardUid } = getDashboardsPageContext(context);
  const [folders, setFolders] = useState<DashboardsTreeNode[]>([]);
  const [nextPage, setNextPage] = useState<number | undefined>(1);
  const [loading, setLoading] = useState(false);
  const loadMoreRef = useRef<HTMLLIElement>(null);

  const loadNextPage = useCallback(async () => {
    if (loading || nextPage === undefined) {
      return;
    }
    setLoading(true);
    try {
      const { nodes, hasMore } = await loadRootFolders(nextPage);
      setFolders((current) => [...current, ...nodes]);
      setNextPage(hasMore ? nextPage + 1 : undefined);
    } finally {
      setLoading(false);
    }
  }, [loading, nextPage]);

  // The first page loads straight away; later pages load when the end of the list scrolls into view
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || nextPage === undefined) {
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      loadNextPage();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadNextPage();
      }
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadNextPage, nextPage]);

  return (
    <SectionSidebarGroup id="folders">
      <SectionSidebarTree
        nodes={folders}
        loadChildren={loadNodeChildren}
        activeId={dashboardUid ?? folderUid}
        persistKey="dashboards.folders"
      />
      {nextPage !== undefined && (
        <li ref={loadMoreRef} aria-busy={loading}>
          {loading && <Spinner />}
        </li>
      )}
    </SectionSidebarGroup>
  );
}
