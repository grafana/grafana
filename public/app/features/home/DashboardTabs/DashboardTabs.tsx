import { css } from '@emotion/css';
import { useCallback, useState } from 'react';

import { type GrafanaTheme2, PluginExtensionPoints } from '@grafana/data';
import { t } from '@grafana/i18n';
import { usePluginComponents } from '@grafana/runtime';
import { Box, Tab, TabContent, TabsBar, useStyles2 } from '@grafana/ui';

import { RecentDashboardsTab } from './RecentDashboardsTab';
import { StarredDashboardsTab } from './StarredDashboardsTab';
import { type HomepageTab } from './types';

const RECENT_TAB_ID = 'recent';
const STARRED_TAB_ID = 'starred';

interface HomepageTabExtensionProps {
  registerTab: (tab: HomepageTab) => void;
}

export function DashboardTabs() {
  const styles = useStyles2(getStyles);
  const [activeTab, setActiveTab] = useState(RECENT_TAB_ID);
  const [recentCount, setRecentCount] = useState<number | undefined>(undefined);
  const [starredCount, setStarredCount] = useState<number | undefined>(undefined);
  const [extensionTabs, setExtensionTabs] = useState<HomepageTab[]>([]);

  const { components: extensionComponents } = usePluginComponents<HomepageTabExtensionProps>({
    extensionPointId: PluginExtensionPoints.HomepageTabs,
  });

  const registerTab = useCallback((tab: HomepageTab) => {
    setExtensionTabs((prev) => {
      if (prev.some((t) => t.id === tab.id)) {
        return prev;
      }
      return [...prev, tab];
    });
  }, []);

  const builtInTabs: HomepageTab[] = [
    {
      id: RECENT_TAB_ID,
      label: t('home.dashboard-tabs.recent', 'Recent'),
      counter: recentCount,
    },
    {
      id: STARRED_TAB_ID,
      label: t('home.dashboard-tabs.starred', 'Starred'),
      icon: 'star',
      counter: starredCount,
    },
  ];

  const contentTabs = [...builtInTabs, ...extensionTabs.filter((tab) => tab.content)];
  const linkTabs = extensionTabs.filter((tab) => tab.href);

  return (
    <Box
      backgroundColor="primary"
      borderColor="weak"
      borderStyle="solid"
      borderRadius="default"
      padding={3}
      direction="column"
      display="flex"
      gap={2}
    >
      <TabsBar>
        {contentTabs.map((tab) => (
          <Tab
            key={tab.id}
            label={tab.label}
            icon={tab.icon}
            active={activeTab === tab.id}
            counter={tab.counter}
            onChangeTab={() => setActiveTab(tab.id)}
          />
        ))}
        {linkTabs.length > 0 && <div className={styles.linkTabsSpacer} />}
        {linkTabs.map((tab) => (
          <Tab key={tab.id} label={tab.label} icon={tab.icon} href={tab.href!} />
        ))}
      </TabsBar>
      <TabContent className={styles.tabContent}>
        {activeTab === RECENT_TAB_ID && <RecentDashboardsTab onCountChange={setRecentCount} />}
        {activeTab === STARRED_TAB_ID && <StarredDashboardsTab onCountChange={setStarredCount} />}
        {extensionTabs
          .filter((tab) => tab.content && activeTab === tab.id)
          .map((tab) => (
            <div key={tab.id}>{tab.content}</div>
          ))}
      </TabContent>

      {/* Render extension components (they return null, just register tabs) */}
      {extensionComponents.map((Component, i) => (
        <Component key={i} registerTab={registerTab} />
      ))}
    </Box>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  tabContent: css({
    // Remove default TabContent padding — list items handle their own
    padding: 0,
  }),
  linkTabsSpacer: css({
    flex: 1,
  }),
});
