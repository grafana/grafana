import React, { useEffect, useState, useCallback } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, TabsBar, TabContent, Tab, Alert } from '@grafana/ui';
import { Layout } from '@grafana/ui/src/components/Layout/Layout';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { PluginDetailsSignature } from '../components/PluginDetailsSignature';
import { PluginDetailsHeader } from '../components/PluginDetailsHeader';
import { PluginDetailsBody } from '../components/PluginDetailsBody';
import { Page as PluginPage } from '../components/Page';
import { Loader } from '../components/Loader';
import { PluginTabLabels, PluginDetailsTab } from '../types';
import { useGetSingle, useFetchStatus } from '../state/hooks';
import { usePluginDetailsTabs } from '../hooks/usePluginDetailsTabs';
import { AppNotificationSeverity } from 'app/types';
import { PluginDetailsDisabledError } from '../components/PluginDetailsDisabledError';

type Props = GrafanaRouteComponentProps<{ pluginId?: string }>;

type State = {
  tabs: PluginDetailsTab[];
  activeTabIndex: number;
};

const DefaultState = {
  tabs: [{ label: PluginTabLabels.OVERVIEW }, { label: PluginTabLabels.VERSIONS }],
  activeTabIndex: 0,
};

export default function PluginDetails({ match }: Props): JSX.Element | null {
  const { pluginId = '' } = match.params;
  const [state, setState] = useState<State>(DefaultState);
  const plugin = useGetSingle(pluginId); // fetches the localplugin settings
  const { tabs } = usePluginDetailsTabs(plugin, DefaultState.tabs);
  const { activeTabIndex } = state;
  const { isLoading } = useFetchStatus();
  const styles = useStyles2(getStyles);
  const setActiveTab = useCallback((activeTabIndex: number) => setState({ ...state, activeTabIndex }), [state]);
  const parentUrl = match.url.substring(0, match.url.lastIndexOf('/'));

  // If an app plugin is uninstalled we need to reset the active tab when the config / dashboards tabs are removed.
  useEffect(() => {
    if (activeTabIndex > tabs.length - 1) {
      setActiveTab(0);
    }
  }, [setActiveTab, activeTabIndex, tabs]);

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
          {tabs.map((tab: PluginDetailsTab, idx: number) => (
            <Tab
              key={tab.label}
              label={tab.label}
              active={idx === activeTabIndex}
              onChangeTab={() => setActiveTab(idx)}
            />
          ))}
        </TabsBar>

        {/* Active tab */}
        <TabContent className={styles.tabContent}>
          <PluginDetailsDisabledError plugin={plugin} className={styles.alert} />
          <PluginDetailsSignature plugin={plugin} className={styles.alert} />
          <PluginDetailsBody tab={tabs[activeTabIndex]} plugin={plugin} />
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
