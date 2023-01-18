import { css } from '@emotion/css';
import React from 'react';
import { useLocation } from 'react-router-dom';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { useStyles2, TabContent, Alert } from '@grafana/ui';
import { Layout } from '@grafana/ui/src/components/Layout/Layout';
import { Page } from 'app/core/components/Page/Page';
import { AppNotificationSeverity } from 'app/types';

import { Loader } from '../components/Loader';
import { PluginDetailsBody } from '../components/PluginDetailsBody';
import { PluginDetailsDisabledError } from '../components/PluginDetailsDisabledError';
import { PluginDetailsSignature } from '../components/PluginDetailsSignature';
import { usePluginDetailsTabs } from '../hooks/usePluginDetailsTabs';
import { usePluginPageExtensions } from '../hooks/usePluginPageExtensions';
import { useGetSingle, useFetchStatus, useFetchDetailsStatus } from '../state/hooks';
import { PluginTabIds } from '../types';

export type Props = {
  // The ID of the plugin
  pluginId: string;
  // The navigation ID used for displaying the sidebar navigation
  navId?: string;
  // Can be used to customise the title & subtitle for the not found page
  notFoundNavModel?: NavModelItem;
  // Can be used to customise the content shown when a plugin with the given ID cannot be found
  notFoundComponent?: React.ReactElement;
};

export function PluginDetailsPage({
  pluginId,
  navId = 'plugins',
  notFoundComponent = <NotFoundPlugin />,
  notFoundNavModel = {
    text: 'Unknown plugin',
    subTitle: 'The requested ID does not belong to any plugin',
    active: true,
  },
}: Props) {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const plugin = useGetSingle(pluginId); // fetches the plugin settings for this Grafana instance
  const { navModel, activePageId } = usePluginDetailsTabs(plugin, queryParams.get('page') as PluginTabIds);
  const { actions, info, subtitle } = usePluginPageExtensions(plugin);
  const { isLoading: isFetchLoading } = useFetchStatus();
  const { isLoading: isFetchDetailsLoading } = useFetchDetailsStatus();
  const styles = useStyles2(getStyles);

  if (isFetchLoading || isFetchDetailsLoading) {
    return (
      <Page
        navId={navId}
        pageNav={{
          text: '',
          active: true,
        }}
      >
        <Loader />
      </Page>
    );
  }

  if (!plugin) {
    return (
      <Page navId={navId} pageNav={notFoundNavModel}>
        {notFoundComponent}
      </Page>
    );
  }

  return (
    <Page navId={navId} pageNav={navModel} actions={actions} subTitle={subtitle} info={info}>
      <Page.Contents>
        <TabContent className={styles.tabContent}>
          <PluginDetailsSignature plugin={plugin} className={styles.alert} />
          <PluginDetailsDisabledError plugin={plugin} className={styles.alert} />
          <PluginDetailsBody queryParams={Object.fromEntries(queryParams)} plugin={plugin} pageId={activePageId} />
        </TabContent>
      </Page.Contents>
    </Page>
  );
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    alert: css`
      margin-bottom: ${theme.spacing(2)};
    `,
    subtitle: css`
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(1)};
    `,
    // Needed due to block formatting context
    tabContent: css`
      overflow: auto;
      height: 100%;
    `,
  };
};

function NotFoundPlugin() {
  return (
    <Layout justify="center" align="center">
      <Alert severity={AppNotificationSeverity.Warning} title="Plugin not found">
        That plugin cannot be found. Please check the url is correct or <br />
        go to the <a href="/plugins">plugin catalog</a>.
      </Alert>
    </Layout>
  );
}
