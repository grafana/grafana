import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAsyncRetry } from 'react-use';

import { type ComponentTypeWithExtensionMeta, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ScrollContainer, Stack, Tab, TabContent, TabsBar, useStyles2 } from '@grafana/ui';
import { SETUPGUIDE_PLUGIN_ID } from 'app/core/constants';
import { getMostUsedDashboards, isMostUsedAvailable } from 'app/features/browse-dashboards/api/mostUsed';
import { getRecentlyViewedDashboards } from 'app/features/browse-dashboards/api/recentlyViewed';
import { useDashboardLocationInfo } from 'app/features/search/hooks/useDashboardLocationInfo';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

import { tabChanged } from '../analytics/main';

import { DashboardTabsSkeleton } from './DashboardTabsSkeleton';
import { MostUsedDashboardsTab } from './MostUsedDashboardsTab';
import { RecentDashboardsTab } from './RecentDashboardsTab';
import { StarredDashboardsTab } from './StarredDashboardsTab';
import { type HomepageTabExtensionProps, type HomepageTab, validateHomepageTab } from './types';

const RECENT_TAB_ID = 'recent';
const MOST_USED_TAB_ID = 'most-used';
const STARRED_TAB_ID = 'starred';
const MAX_RECENT = 20;
const MAX_MOST_USED = 20;
const MAX_STARRED = 30;
const DEFAULT_TAB_IDS = [RECENT_TAB_ID, MOST_USED_TAB_ID, STARRED_TAB_ID];

function DashboardExtensionTab({
  Component,
  registerTab,
  activeTab,
}: {
  Component: ComponentTypeWithExtensionMeta<HomepageTabExtensionProps>;
  registerTab: (tab: HomepageTab) => () => void;
  activeTab: string;
}) {
  const [id, setId] = useState<string | null>(null);
  const register = useCallback(
    (tab: unknown) => {
      validateHomepageTab(tab);

      setId(tab.id);
      const unregister = registerTab(tab);

      return () => {
        setId(null);
        unregister();
      };
    },
    [registerTab]
  );

  return <Component register={register} active={activeTab === id} />;
}

interface Props {
  extensionComponents: Array<ComponentTypeWithExtensionMeta<HomepageTabExtensionProps>>;
}

export function DashboardTabs({ extensionComponents }: Props) {
  const styles = useStyles2(getStyles);
  const [activeTab, setActiveTab] = useState(RECENT_TAB_ID);
  const [extensionTabs, setExtensionTabs] = useState<HomepageTab[]>([]);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const {
    value: recentDashboards,
    loading: recentLoading,
    error: recentError,
    retry: recentRetry,
  } = useAsyncRetry(() => getRecentlyViewedDashboards(MAX_RECENT), []);

  const {
    value: starredDashboards,
    loading: starredLoading,
    error: starredError,
    retry: starredRetry,
  } = useAsyncRetry(async () => {
    const response = await getGrafanaSearcher().starred({ limit: MAX_STARRED });
    return response.view.toArray();
  }, []);

  const mostUsedAvailable = isMostUsedAvailable();

  const {
    value: mostUsedDashboards,
    loading: mostUsedLoading,
    error: mostUsedError,
    retry: mostUsedRetry,
  } = useAsyncRetry(
    () => (mostUsedAvailable ? getMostUsedDashboards(MAX_MOST_USED) : Promise.resolve([])),
    [mostUsedAvailable]
  );

  const hasRecent = !!recentDashboards?.length;
  const hasMostUsed = mostUsedAvailable && !!mostUsedDashboards?.length;
  const hasStarred = !!starredDashboards?.length;
  const initialLoading = recentLoading || starredLoading || (mostUsedAvailable && mostUsedLoading);

  const hasDashboards = hasRecent || hasMostUsed || hasStarred;
  const { foldersByUid } = useDashboardLocationInfo(hasDashboards);

  const registerTab = useCallback((tab: HomepageTab) => {
    setExtensionTabs((prev) => [...prev, tab]);
    return () => setExtensionTabs((prev) => prev.filter((t) => t !== tab));
  }, []);

  // Auto-switch to the non-empty tab when initial data finishes loading
  const didAutoSwitch = useRef(false);

  // Tabs worth landing on, in display order: default tabs with content, then non-link extension tabs.
  const selectableTabs = useMemo(
    () => [
      ...(hasRecent ? [RECENT_TAB_ID] : []),
      ...(hasMostUsed ? [MOST_USED_TAB_ID] : []),
      ...(hasStarred ? [STARRED_TAB_ID] : []),
      ...extensionTabs.filter((tab) => !tab.href).map((tab) => tab.id),
    ],
    [hasRecent, hasMostUsed, hasStarred, extensionTabs]
  );

  useEffect(() => {
    if (didAutoSwitch.current || initialLoading) {
      return;
    }

    // Already on a default tab with content or a custom/extension tab: lock in and stay.
    if (selectableTabs.includes(activeTab)) {
      didAutoSwitch.current = true;
      return;
    }

    // Current default tab is empty - switch to the first tab (extensions included) with content
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

  if (!initialLoadDone) {
    return <DashboardTabsSkeleton />;
  }

  const builtInTabs: HomepageTab[] = [
    {
      id: RECENT_TAB_ID,
      label: t('home.dashboard-tabs.recent', 'Recent'),
      activeLabel: t('home.dashboard-tabs.recent-active', 'Recent dashboards'),
      counter: recentDashboards?.length,
    },
    ...(mostUsedAvailable
      ? [
          {
            id: MOST_USED_TAB_ID,
            label: t('home.dashboard-tabs.most-used', 'Most used'),
            activeLabel: t('home.dashboard-tabs.most-used-active', 'Most used dashboards'),
            counter: mostUsedDashboards?.length,
          },
        ]
      : []),
    {
      id: STARRED_TAB_ID,
      label: t('home.dashboard-tabs.starred', 'Starred'),
      activeLabel: t('home.dashboard-tabs.starred-active', 'Starred dashboards'),
      counter: starredDashboards?.length,
    },
  ];

  const contentTabs = [...builtInTabs, ...extensionTabs.filter((tab) => !tab.href)];
  const linkTabs = extensionTabs.filter((tab) => tab.href);

  return (
    <Stack direction="column" gap={2} grow={1} minHeight={0}>
      <TabsBar>
        {contentTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          // Keep a consistent tab bar width when on a custom tab by forcing the active label for recent dashboards
          const forceActiveLabel = !DEFAULT_TAB_IDS.includes(activeTab) && tab.id === RECENT_TAB_ID;
          return (
            <Tab
              key={tab.id}
              label={isActive || forceActiveLabel ? (tab.activeLabel ?? tab.label) : tab.label}
              active={isActive}
              counter={tab.counter}
              onChangeTab={() => {
                setActiveTab(tab.id);
                tabChanged({ tab: tab.id });
              }}
            />
          );
        })}
        {linkTabs.length > 0 && <div className={styles.linkTabsSpacer} />}
        {linkTabs.map((tab) => (
          <Tab key={tab.id} label={tab.label} icon={tab.icon} href={tab.href!} />
        ))}
      </TabsBar>

      {DEFAULT_TAB_IDS.includes(activeTab) && (
        <TabContent className={styles.tabContent}>
          <ScrollContainer showScrollIndicators>
            {activeTab === RECENT_TAB_ID && (
              <RecentDashboardsTab
                dashboards={recentDashboards ?? []}
                loading={recentLoading}
                error={recentError}
                retry={recentRetry}
                foldersByUid={foldersByUid}
                onStarChange={starredRetry}
              />
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
        </TabContent>
      )}

      {/* Render extension component tabs without background + scroller */}
      {extensionComponents
        .filter((Component) => Component.meta.pluginId === SETUPGUIDE_PLUGIN_ID)
        .map((Component, i) => (
          <DashboardExtensionTab key={i} Component={Component} registerTab={registerTab} activeTab={activeTab} />
        ))}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  tabContent: css({
    padding: 0,
    background: theme.colors.background.primary,
    borderRadius: theme.shape.radius.default,
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  }),
  linkTabsSpacer: css({
    flex: 1,
  }),
});
