import { css } from '@emotion/css';
import * as React from 'react';
import { useLocation } from 'react-router-dom-v5-compat';
import { useMedia } from 'react-use';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Box, Stack, TabContent, TextLink, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { AppNotificationSeverity } from 'app/types/appNotifications';

import { Loader } from '../components/Loader';
import { PluginDetailsBody } from '../components/PluginDetailsBody';
import { PluginDetailsDisabledError } from '../components/PluginDetailsDisabledError';
import { PluginDetailsPanel } from '../components/PluginDetailsPanel';
import { PluginDetailsSignature } from '../components/PluginDetailsSignature';
import { usePluginDetailsTabs } from '../hooks/usePluginDetailsTabs';
import { usePluginPageExtensions } from '../hooks/usePluginPageExtensions';
import { useGetSingle, useFetchStatus, useFetchDetailsStatus } from '../state/hooks';
import { PluginTabIds } from '../types';

import { PluginDetailsDeprecatedWarning } from './PluginDetailsDeprecatedWarning';

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
  notFoundNavModel,
}: Props) {
  const location = useLocation();
  const notFoundModel = notFoundNavModel ?? {
    text: t('plugins.plugin-details-page.not-found-model.text.unknown-plugin', 'Unknown plugin'),
    subTitle: t(
      'plugins.plugin-details-page.not-found-model.subTitle.requested-belong-plugin',
      'The requested ID does not belong to any plugin'
    ),
    active: true,
  };
  const queryParams = new URLSearchParams(location.search);
  const plugin = useGetSingle(pluginId); // fetches the plugin settings for this Grafana instance
  const isNarrowScreen = useMedia('(max-width: 600px)');
  const { navModel, activePageId } = usePluginDetailsTabs(
    plugin,
    queryParams.get('page') as PluginTabIds,
    isNarrowScreen
  );
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
      <Page navId={navId} pageNav={notFoundModel}>
        {notFoundComponent}
      </Page>
    );
  }

  return (
    <Page navId={navId} pageNav={navModel} actions={actions} subTitle={subtitle}>
      <Stack gap={4} justifyContent="space-between" direction={{ xs: 'column-reverse', sm: 'row' }}>
        <Page.Contents>
          <TabContent className={styles.tabContent}>
            <PluginDetailsSignature plugin={plugin} className={styles.alert} />
            <PluginDetailsDisabledError plugin={plugin} className={styles.alert} />
            <PluginDetailsDeprecatedWarning plugin={plugin} className={styles.alert} />
            <PluginDetailsBody
              queryParams={Object.fromEntries(queryParams)}
              plugin={plugin}
              pageId={activePageId}
              info={info}
              showDetails={isNarrowScreen}
            />
          </TabContent>
        </Page.Contents>
        {!isNarrowScreen && <PluginDetailsPanel pluginExtentionsInfo={info} plugin={plugin} />}
      </Stack>
    </Page>
  );
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    alert: css({
      marginBottom: theme.spacing(2),
    }),
    subtitle: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    // Needed due to block formatting context
    tabContent: css({
      paddingLeft: '5px',
      width: '100%',
    }),
  };
};

function NotFoundPlugin() {
  return (
    <Stack justifyContent="center" alignItems="center" height="100%">
      <Box>
        <Alert
          severity={AppNotificationSeverity.Warning}
          title={t('plugins.not-found-plugin.title-plugin-not-found', 'Plugin not found')}
        >
          <Trans i18nKey="plugins.not-found-plugin.body-plugin-not-found">
            That plugin cannot be found. Please check the url is correct or <br />
            go to the <TextLink href="/plugins">plugin catalog</TextLink>.
          </Trans>
        </Alert>
      </Box>
    </Stack>
  );
}
