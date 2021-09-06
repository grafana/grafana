import React, { useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, TabsBar, TabContent, Tab, Alert } from '@grafana/ui';

import { AppNotificationSeverity } from 'app/types';
import { PluginDetailsSignature } from '../components/PluginDetailsSignature';
import { PluginDetailsHeader } from '../components/PluginDetailsHeader';
import { usePluginDetails } from '../hooks/usePluginDetails';
import { Page as PluginPage } from '../components/Page';
import { Loader } from '../components/Loader';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { ActionTypes, PluginTabLabels } from '../types';
import { PluginDetailsBody } from '../components/PluginDetailsBody';
import { useGetSingle, useFetchStatus } from '../state/hooks';

type Props = GrafanaRouteComponentProps<{ pluginId?: string }>;

type TabType = {
  label: PluginTabLabels;
};

type State = {
  tabs: TabType[];
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
  // const pluginExtra = loadPlugin(pluginId); // fetches the local plugin settings as well
  const { isLoading, error } = useFetchStatus();
  const styles = useStyles2(getStyles);
  const { tabs, activeTabIndex } = state;
  const parentUrl = match.url.substring(0, match.url.lastIndexOf('/'));
  const setActiveTab = (activeTabIndex: number) => setState({ ...state, activeTabIndex });

  if (isLoading) {
    return (
      <Page>
        <Loader />
      </Page>
    );
  }

  if (!plugin) {
    // TODO<Return with a 404 component here>
    return <>Plugin not found.</>;
  }

  return (
    <Page>
      <PluginPage>
        <PluginDetailsHeader currentUrl={match.url} parentUrl={parentUrl} plugin={plugin} />

        {/* Tab navigation */}
        <TabsBar>
          {tabs.map((tab: TabType, idx: number) => (
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
          {/* Cannot get plugin meta data. e.g. cannot talk to gcom and plugin is not installed. */}
          {/* {pluginConfig.loadError && (
            <Alert severity={AppNotificationSeverity.Error} title="Error Loading Plugin">
              <>
                Check the server startup logs for more information. <br />
                If this plugin was loaded from git, make sure it was compiled.
              </>
            </Alert>
          )} */}
          <PluginDetailsSignature plugin={plugin} className={styles.signature} />
          <PluginDetailsBody tab={tabs[activeTabIndex]} plugin={plugin} />
        </TabContent>
      </PluginPage>
    </Page>
  );
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    signature: css`
      margin: ${theme.spacing(3)};
      margin-bottom: 0;
    `,
    // Needed due to block formatting context
    tabContent: css`
      overflow: auto;
    `,
  };
};
