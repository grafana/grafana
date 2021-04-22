import React from 'react';
import { css } from '@emotion/css';

import { AppRootProps, GrafanaTheme } from '@grafana/data';
import { stylesFactory, useTheme } from '@grafana/ui';

import { PluginList } from '../components/PluginList';
import { usePlugins } from '../hooks/usePlugins';
import { MarketplaceAppSettings } from '../types';

export const Library = ({ meta }: AppRootProps) => {
  const { includeUnsigned, pluginDir } = meta.jsonData as MarketplaceAppSettings;

  const plugins = usePlugins({ pluginDir, includeUnsigned, includeEnterprise: true });
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <>
      <h1 className={styles.header}>Library</h1>
      {plugins.status === 'DONE' ? (
        <PluginList
          plugins={plugins.items.filter((plugin) => !!plugins.installedPlugins?.find((_) => _.id === plugin.slug))}
        />
      ) : null}
    </>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    header: css`
      margin-bottom: ${theme.spacing.lg};
    `,
  };
});
