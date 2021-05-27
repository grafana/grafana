import React, { useEffect } from 'react';
import { css } from '@emotion/css';
import { AppRootProps, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { PLUGIN_ROOT } from '../constants';
import { PluginList } from '../components/PluginList';
import { usePlugins } from '../hooks/usePlugins';
import { Page } from 'components/Page';
import { Loader } from 'components/Loader';
import { CatalogTab, getCatalogNavModel } from './nav';

export const Library = ({ meta, onNavChanged, basename }: AppRootProps) => {
  const { isLoading, items, installedPlugins } = usePlugins();
  const styles = useStyles2(getStyles);

  useEffect(() => {
    onNavChanged(getCatalogNavModel(CatalogTab.Library, basename));
  }, [onNavChanged, basename]);

  const filteredPlugins = items.filter((plugin) => !!installedPlugins.find((_) => _.id === plugin.slug));

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Page>
      <h1 className={styles.header}>Library</h1>
      {filteredPlugins.length > 0 ? (
        <PluginList plugins={filteredPlugins} />
      ) : (
        <p>
          You haven&#39;t installed any plugins. Browse the{' '}
          <a className={styles.link} href={`${PLUGIN_ROOT}/browse?sortBy=popularity`}>
            catalog
          </a>{' '}
          for plugins to install.
        </p>
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
    link: css`
      text-decoration: underline;
    `,
  };
};
