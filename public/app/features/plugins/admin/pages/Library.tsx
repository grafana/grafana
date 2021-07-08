import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { PluginList } from '../components/PluginList';
import { usePlugins } from '../hooks/usePlugins';
import { Page as PluginPage } from '../components/Page';
import { Loader } from '../components/Loader';
import { CatalogTab, getCatalogNavModel } from './nav';
import { Page } from 'app/core/components/Page/Page';

export default function Library(): JSX.Element | null {
  const { isLoading, items, installedPlugins } = usePlugins();
  const styles = useStyles2(getStyles);

  const filteredPlugins = items.filter((plugin) => !!installedPlugins.find((_) => _.id === plugin.slug));

  if (isLoading) {
    return (
      <Page navModel={getCatalogNavModel(CatalogTab.Library, '/plugins')}>
        <Page.Contents>
          <Loader />
        </Page.Contents>
      </Page>
    );
  }

  return (
    <Page navModel={getCatalogNavModel(CatalogTab.Library, '/plugins')}>
      <Page.Contents>
        <PluginPage>
          <h1 className={styles.header}>Library</h1>
          {filteredPlugins.length > 0 ? (
            <PluginList plugins={filteredPlugins} />
          ) : (
            <p>
              You haven&#39;t installed any plugins. Browse the{' '}
              <a className={styles.link} href={'/plugins/browse?sortBy=popularity'}>
                catalog
              </a>{' '}
              for plugins to install.
            </p>
          )}
        </PluginPage>
      </Page.Contents>
    </Page>
  );
}

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
