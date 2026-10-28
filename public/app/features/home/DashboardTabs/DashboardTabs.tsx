import { useEffect, useMemo, useRef, useState } from 'react';
import { useAsyncRetry } from 'react-use';

import { t, Trans } from '@grafana/i18n';
import { Box, ScrollContainer, Stack, Tab, TabContent, TabsBar, Text } from '@grafana/ui';
import { getMostUsedDashboards, isMostUsedAvailable } from 'app/features/browse-dashboards/api/mostUsed';
import { useDashboardLocationInfo } from 'app/features/search/hooks/useDashboardLocationInfo';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

import { CardFooter, FooterAction } from '../FooterActions';
import { HomeSection } from '../HomeSection';
import { tabChanged } from '../analytics/main';

import { DashboardTabsSkeleton } from './DashboardTabsSkeleton';
import { MostUsedDashboardsTab } from './MostUsedDashboardsTab';
import { RecentActivityFooter } from './RecentActivityFooter';
import { RecentActivityTab } from './RecentActivityTab';
import { StarredDashboardsTab } from './StarredDashboardsTab';
import { DASHBOARD_TABS_SCROLL_HEIGHT } from './types';
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

  const tabs = [
    {
      id: RECENT_TAB_ID,
      label: t('home.dashboard-tabs.recent', 'Recent'),
      // What the list shows; the whole history is one filter option away.
      counter: recent.items.length,
    },
    ...(mostUsedAvailable
      ? [
          {
            id: MOST_USED_TAB_ID,
            label: t('home.dashboard-tabs.most-used', 'Most used'),
            counter: mostUsedDashboards?.length,
          },
        ]
      : []),
    {
      id: STARRED_TAB_ID,
      label: t('home.dashboard-tabs.starred', 'Starred'),
      counter: starredDashboards?.length,
    },
  ];

  // The Recent footer belongs to its list: only once the list is loaded with rows, an empty row of the same height
  // until then. The dashboard tabs link out.
  const footer =
    activeTab === RECENT_TAB_ID ? (
      !recent.loading && !recent.error && recent.total > 0 ? (
        <RecentActivityFooter recent={recent} />
      ) : (
        <CardFooter />
      )
    ) : (
      <CardFooter>
        <FooterAction href="/dashboards">
          <Trans i18nKey="home.dashboard-tabs.view-all-dashboards">View all dashboards</Trans>
        </FooterAction>
      </CardFooter>
    );

  const renderContent = () => (
    <>
      <TabsBar>
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            label={tab.label}
            active={activeTab === tab.id}
            counter={tab.counter}
            onChangeTab={() => {
              setActiveTab(tab.id);
              tabChanged({ tab: tab.id });
            }}
          />
        ))}
      </TabsBar>

      <TabContent>
        <ScrollContainer
          showScrollIndicators
          maxHeight={`${DASHBOARD_TABS_SCROLL_HEIGHT}px`}
          minHeight={`${DASHBOARD_TABS_SCROLL_HEIGHT}px`}
        >
          {activeTab === RECENT_TAB_ID && (
            <RecentActivityTab recent={recent} foldersByUid={foldersByUid} onStarChange={starredRetry} />
          )}
          {activeTab === MOST_USED_TAB_ID && (
            <MostUsedDashboardsTab
              dashboards={mostUsedDashboards ?? []}
              loading={mostUsedLoading}
              error={mostUsedError}
              retry={mostUsedRetry}
              foldersByUid={foldersByUid}
            />
          )}
          {activeTab === STARRED_TAB_ID && (
            <StarredDashboardsTab
              dashboards={starredDashboards ?? []}
              loading={starredLoading}
              error={starredError}
              retry={starredRetry}
              foldersByUid={foldersByUid}
            />
          )}
        </ScrollContainer>
        {/* Pinned below the scroll area so it stays visible however long the list is; always there, at one
            height, so the card never moves between tabs or while Recent loads. */}
        <Box padding={1} paddingTop={1.5}>
          {footer}
        </Box>
      </TabContent>
    </>
  );
  // The header and card frame don't depend on data; only the tabs wait, since which one to land on isn't known yet.
  const content = initialLoadDone ? renderContent() : <DashboardTabsSkeleton />;
  return (
    <Stack direction="column" gap={1} minWidth={0}>
      <Stack justifyContent="space-between" alignItems="center" minHeight={4}>
        <Text element="h2" variant="h5">
          <Trans i18nKey="home.dashboard-tabs.title">Jump back in</Trans>
        </Text>
      </Stack>

      <HomeSection paddingX={2} paddingY={1} display="flex" direction="column" grow={1}>
        {content}
      </HomeSection>
    </Stack>
  );
}
