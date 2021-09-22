import React, { useState, useEffect } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, TabsBar, TabContent, Tab, Alert } from '@grafana/ui';
import { locationService } from '@grafana/runtime';
import { Layout } from '@grafana/ui/src/components/Layout/Layout';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { PluginDetailsSignature } from '../components/PluginDetailsSignature';
import { PluginDetailsHeader } from '../components/PluginDetailsHeader';
import { PluginDetailsBody } from '../components/PluginDetailsBody';
import { Page as PluginPage } from '../components/Page';
import { Loader } from '../components/Loader';
import { PluginTabLabels, PluginTabIds, PluginDetailsTab } from '../types';
import { useGetSingle, useFetchStatus } from '../state/hooks';
import { usePluginDetailsTabs } from '../hooks/usePluginDetailsTabs';
import { AppNotificationSeverity } from 'app/types';
import { PluginDetailsDisabledError } from '../components/PluginDetailsDisabledError';

type Props = GrafanaRouteComponentProps<{ pluginId?: string }>;

export default function PluginDetails({ match, queryParams }: Props): JSX.Element | null {
  const {
    params: { pluginId = '' },
    url,
  } = match;
  const pageId = (queryParams.page as PluginTabIds) || PluginTabIds.OVERVIEW;
  const parentUrl = url.substring(0, url.lastIndexOf('/'));
  const defaultTabs = [
    { label: PluginTabLabels.OVERVIEW, id: PluginTabIds.OVERVIEW, href: `${url}?page=${PluginTabIds.OVERVIEW}` },
    { label: PluginTabLabels.VERSIONS, id: PluginTabIds.VERSIONS, href: `${url}?page=${PluginTabIds.VERSIONS}` },
  ];
  const [activeTabIndex, setActiveTabIndex] = useState(Object.values(PluginTabIds).indexOf(pageId));
  const plugin = useGetSingle(pluginId); // fetches the localplugin settings
  const { tabs } = usePluginDetailsTabs(plugin, defaultTabs);
  const { isLoading } = useFetchStatus();
  const styles = useStyles2(getStyles);

  // If an app plugin is uninstalled we need to reset the active tab when the config / dashboards tabs are removed.
  useEffect(() => {
    if (activeTabIndex > tabs.length - 1) {
      setActiveTabIndex(0);
      locationService.replace(`${url}?page=${PluginTabIds.OVERVIEW}`);
    }
  }, [url, activeTabIndex, tabs]);

  if (isLoading) {
    return (
      <Page>
        <Loader />
      </Page>
    );
  }

  if (!plugin) {
    return (
      <Layout justify="center" align="center">
        <Alert severity={AppNotificationSeverity.Warning} title="Plugin not found">
          That plugin cannot be found. Please check the url is correct or <br />
          go to the <a href={parentUrl}>plugin catalog</a>.
        </Alert>
      </Layout>
    );
  }

  return (
    <Page>
      <PluginPage>
        <PluginDetailsHeader currentUrl={match.url} parentUrl={parentUrl} plugin={plugin} />

        {/* Tab navigation */}
        <TabsBar>
          {tabs.map((tab: PluginDetailsTab, idx) => {
            return (
              <Tab
                key={tab.label}
                label={tab.label}
                href={tab.href}
                active={tab.id === pageId}
                onChangeTab={() => setActiveTabIndex(idx)}
              />
            );
          })}
        </TabsBar>

        {/* Active tab */}
        <TabContent className={styles.tabContent}>
          <PluginDetailsDisabledError plugin={plugin} className={styles.alert} />
          <PluginDetailsSignature plugin={plugin} className={styles.alert} />
          <PluginDetailsBody queryParams={queryParams} plugin={plugin} />
        </TabContent>
      </PluginPage>
    </Page>
  );
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    alert: css`
      margin: ${theme.spacing(3)};
      margin-bottom: 0;
    `,
    // Needed due to block formatting context
    tabContent: css`
      overflow: auto;
    `,
  };
};
