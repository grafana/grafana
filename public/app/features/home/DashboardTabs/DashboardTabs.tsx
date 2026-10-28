import { useEffect, useMemo, useRef, useState } from 'react';
import { useAsyncRetry } from 'react-use';

import { t, Trans } from '@grafana/i18n';
import { getMostUsedDashboards, isMostUsedAvailable } from 'app/features/browse-dashboards/api/mostUsed';
import { useDashboardLocationInfo } from 'app/features/search/hooks/useDashboardLocationInfo';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

import { FooterAction } from '../FooterActions';
import { type HomeCardTab, HomeTabbedCard } from '../HomeTabbedCard';

import { MostUsedDashboardsTab } from './MostUsedDashboardsTab';
import { ClearRecentActivityAction, RecentActivityFilterCombobox } from './RecentActivityFooter';
import { RecentActivityTab } from './RecentActivityTab';
import { StarredDashboardsTab } from './StarredDashboardsTab';
import { useRecentActivity } from './useRecentActivity';

const RECENT_TAB_ID = 'recent';
const MOST_USED_TAB_ID = 'most-used';
const STARRED_TAB_ID = 'starred';
const MAX_MOST_USED = 20;
const MAX_STARRED = 30;

export function DashboardTabs() {
  const mostUsedAvailable = isMostUsedAvailable();
  const [activeTab, setActiveTab] = useState(RECENT_TAB_ID);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const recent = useRecentActivity();

  const {
    value: starredDashboards,
    loading: starredLoading,
    error: starredError,
    retry: starredRetry,
  } = useAsyncRetry(async () => {
    const response = await getGrafanaSearcher().starred({ limit: MAX_STARRED });
    return response.view.toArray();
  }, []);

  const {
    value: mostUsedDashboards,
    loading: mostUsedLoading,
    error: mostUsedError,
    retry: mostUsedRetry,
  } = useAsyncRetry(
    () => (mostUsedAvailable ? getMostUsedDashboards(MAX_MOST_USED) : Promise.resolve([])),
    [mostUsedAvailable]
  );

  const hasRecent = recent.total > 0;
  const hasMostUsed = mostUsedAvailable && !!mostUsedDashboards?.length;
  const hasStarred = !!starredDashboards?.length;
  const initialLoading = recent.loading || starredLoading || (mostUsedAvailable && mostUsedLoading);

  // Folder names are only needed when some row shows a dashboard.
  const hasDashboards = hasMostUsed || hasStarred || recent.kinds.includes('dashboard');
  const { foldersByUid } = useDashboardLocationInfo(hasDashboards);

  // Auto-switch to the non-empty tab when initial data finishes loading
  const didAutoSwitch = useRef(false);

  // Tabs worth landing on, in display order.
  const selectableTabs = useMemo(
    () => [
      ...(hasRecent ? [RECENT_TAB_ID] : []),
      ...(hasMostUsed ? [MOST_USED_TAB_ID] : []),
      ...(hasStarred ? [STARRED_TAB_ID] : []),
    ],
    [hasRecent, hasMostUsed, hasStarred]
  );

  useEffect(() => {
    if (didAutoSwitch.current || initialLoading) {
      return;
    }

    // Already on a tab with content: lock in and stay.
    if (selectableTabs.includes(activeTab)) {
      didAutoSwitch.current = true;
      return;
    }

    // Current tab is empty - switch to the first tab with content
    const [target] = selectableTabs;
    if (target) {
      setActiveTab(target);
      didAutoSwitch.current = true;
    }
  }, [initialLoading, selectableTabs, activeTab]);

  // Latch once loaded so a later per-source refetch can't flash the skeleton back.
  useEffect(() => {
    if (!initialLoading) {
      setInitialLoadDone(true);
    }
  }, [initialLoading]);

  // The Recent footer belongs to its list: only once the list is loaded with rows, an empty row of the same height
  // until then. The dashboard tabs link out.
  const showRecentFooter = !recent.loading && !recent.error && recent.total > 0;
  const viewAllDashboards = (
    <FooterAction href="/dashboards">
      <Trans i18nKey="home.dashboard-tabs.view-all-dashboards">View all dashboards</Trans>
    </FooterAction>
  );

  const tabs: HomeCardTab[] = [
    {
      id: RECENT_TAB_ID,
      label: t('home.dashboard-tabs.recent', 'Recent'),
      // What the list shows; the whole history is one filter option away.
      counter: recent.items.length,
      content: <RecentActivityTab recent={recent} foldersByUid={foldersByUid} onStarChange={starredRetry} />,
      filter: showRecentFooter && recent.kinds.length > 1 && <RecentActivityFilterCombobox recent={recent} />,
      footer: showRecentFooter && <ClearRecentActivityAction recent={recent} />,
    },
    ...(mostUsedAvailable
      ? [
          {
            id: MOST_USED_TAB_ID,
            label: t('home.dashboard-tabs.most-used', 'Most used'),
            counter: mostUsedDashboards?.length,
            content: (
              <MostUsedDashboardsTab
                dashboards={mostUsedDashboards ?? []}
                loading={mostUsedLoading}
                error={mostUsedError}
                retry={mostUsedRetry}
                foldersByUid={foldersByUid}
              />
            ),
            footer: viewAllDashboards,
          },
        ]
      : []),
    {
      id: STARRED_TAB_ID,
      label: t('home.dashboard-tabs.starred', 'Starred'),
      counter: starredDashboards?.length,
      content: (
        <StarredDashboardsTab
          dashboards={starredDashboards ?? []}
          loading={starredLoading}
          error={starredError}
          retry={starredRetry}
          foldersByUid={foldersByUid}
        />
      ),
      footer: viewAllDashboards,
    },
  ];

  return (
    <HomeTabbedCard
      title={t('home.dashboard-tabs.title', 'Jump back in')}
      idPrefix="dashboard-tabs"
      tabs={tabs}
      activeTabId={activeTab}
      onTabChange={setActiveTab}
      // The header and card frame don't depend on data; only the tabs wait, since which one to land on isn't known yet.
      loading={!initialLoadDone}
    />
  );
}
