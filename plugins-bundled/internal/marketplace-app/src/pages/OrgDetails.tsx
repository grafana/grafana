import React from 'react';
import { css } from '@emotion/css';

import { AppRootProps, GrafanaTheme } from '@grafana/data';

import { PluginList } from '../components/PluginList';
import { usePlugins } from '../hooks/usePlugins';
import { useOrg } from '../hooks/useOrg';
import { MarketplaceAppSettings } from '../types';

import { stylesFactory, useTheme } from '@grafana/ui';

export const OrgDetails = ({ query, meta }: AppRootProps) => {
  const { orgSlug } = query;
  const { includeUnsigned } = meta.jsonData as MarketplaceAppSettings;

  const orgData = useOrg(orgSlug);
  const pluginsData = usePlugins({ includeUnsigned });
  const theme = useTheme();
  const styles = getStyles(theme);

  const plugins = pluginsData.items.filter((plugin) => plugin.orgSlug === orgSlug);

  return (
    <>
      <div
        className={css`
          display: flex;
          margin-bottom: 64px;
          align-items: center;
        `}
      >
        <img
          src={orgData.org?.avatarUrl}
          className={css`
            object-fit: cover;
            width: 100%;
            height: 64px;
            max-width: 64px;
          `}
        />
        <h1 className={styles.header}>{orgData.org?.name}</h1>
      </div>
      <PluginList plugins={plugins} />
    </>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    header: css`
      margin-left: ${theme.spacing.lg};
    `,
  };
});
