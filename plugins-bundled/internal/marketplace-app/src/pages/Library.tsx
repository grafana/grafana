import React from 'react';
import { css } from '@emotion/css';

import { AppRootProps, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { PluginList } from '../components/PluginList';
import { usePlugins } from '../hooks/usePlugins';
import { MarketplaceAppSettings } from '../types';
import { Page } from 'components/Page';

export const Library = ({ meta }: AppRootProps) => {
  const { includeUnsigned, pluginDir } = meta.jsonData as MarketplaceAppSettings;

  const plugins = usePlugins({ pluginDir, includeUnsigned, includeEnterprise: true });
  const styles = useStyles2(getStyles);

  return (
    <Page>
      <h1 className={styles.header}>Library</h1>
      {plugins.status === 'DONE' ? (
        <PluginList
          plugins={plugins.items.filter((plugin) => !!plugins.installedPlugins?.find((_) => _.id === plugin.slug))}
        />
      ) : null}
    </Page>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    header: css`
      margin-bottom: ${theme.spacing(3)};
    `,
  };
};
