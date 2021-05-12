import React from 'react';
import { css } from '@emotion/css';

import { AppRootProps, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { PluginList } from '../components/PluginList';
import { usePlugins } from '../hooks/usePlugins';
import { Page } from 'components/Page';
import { Loader } from 'components/Loader';

export const Library = ({ meta }: AppRootProps) => {
  const { status, items, installedPlugins } = usePlugins(true);
  const styles = useStyles2(getStyles);

  const filteredPlugins = items.filter((plugin) => !!installedPlugins.find((_) => _.id === plugin.slug));

  if (status === 'LOADING') {
    return <Loader />;
  }

  return (
    <Page>
      <h1 className={styles.header}>Library</h1>
      {filteredPlugins.length > 0 ? (
        <PluginList plugins={filteredPlugins} />
      ) : (
        <p>You haven&#39;t installed any plugins!</p>
      )}
    </Page>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    header: css`
      margin-bottom: ${theme.spacing(3)};
      margin-top: ${theme.spacing(3)};
    `,
  };
};
