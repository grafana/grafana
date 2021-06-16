import React from 'react';
import { css } from '@emotion/css';

import { AppRootProps, GrafanaTheme2 } from '@grafana/data';

import { PluginList } from '../components/PluginList';
import { usePlugins } from '../hooks/usePlugins';
import { useOrg } from '../hooks/useOrg';

import { useStyles2 } from '@grafana/ui';
import { Page } from 'components/Page';
import { Loader } from 'components/Loader';

export const OrgDetails = ({ query }: AppRootProps) => {
  const { orgSlug } = query;

  const orgData = useOrg(orgSlug);
  const { isLoading, items } = usePlugins();
  const styles = useStyles2(getStyles);

  const plugins = items.filter((plugin) => plugin.orgSlug === orgSlug);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Page>
      <div className={styles.header}>
        <img src={orgData.org?.avatarUrl} className={styles.img} />
        <h1 className={styles.orgName}>{orgData.org?.name}</h1>
      </div>
      <PluginList plugins={plugins} />
    </Page>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    header: css`
      align-items: center;
      display: flex;
      margin-bottom: ${theme.spacing(3)};
      margin-top: ${theme.spacing(3)};
    `,
    img: css`
      height: 64px;
      max-width: 64px;
      object-fit: cover;
      width: 100%;
    `,
    orgName: css`
      margin-left: ${theme.spacing(3)};
    `,
  };
};
