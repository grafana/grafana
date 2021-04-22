import React from 'react';
import { cx, css } from '@emotion/css';

import { dateTimeParse, AppRootProps, GrafanaTheme } from '@grafana/data';
import { useTheme, Legend, stylesFactory, Button } from '@grafana/ui';

import { Card } from '../components/Card';
import { Grid } from '../components/Grid';
import { PluginList } from '../components/PluginList';
import { SearchField } from '../components/SearchField';
import { PluginTypeIcon } from '../components/PluginTypeIcon';
import { usePlugins } from '../hooks/usePlugins';
import { useHistory } from '../hooks/useHistory';
import { MarketplaceAppSettings, Plugin } from '../types';

export const Discover = ({ meta }: AppRootProps) => {
  const { includeUnsigned, includeEnterprise } = meta.jsonData as MarketplaceAppSettings;

  const plugins = usePlugins({ includeEnterprise, includeUnsigned });
  const history = useHistory();
  const theme = useTheme();
  const styles = getStyles(theme);

  const onSearch = (q: string) => {
    history.push({ query: { q, tab: 'browse' } });
  };

  const onBrowse = ({ filterBy, sortBy }: { filterBy?: string; sortBy?: string }) => {
    history.push({ query: { tab: 'browse', filterBy, sortBy } });
  };

  const featuredPlugins = plugins.items.filter((_) => _.featured > 0);
  featuredPlugins.sort((a: Plugin, b: Plugin) => {
    return b.featured - a.featured;
  });

  const recentlyAdded = plugins.items.filter((_) => true);
  recentlyAdded.sort((a: Plugin, b: Plugin) => {
    const at = dateTimeParse(a.createdAt);
    const bt = dateTimeParse(b.createdAt);
    return bt.valueOf() - at.valueOf();
  });

  const mostPopular = plugins.items.filter((_) => true);
  mostPopular.sort((a: Plugin, b: Plugin) => {
    return b.popularity - a.popularity;
  });

  return (
    <>
      <SearchField onSearch={onSearch} />

      {/* Featured */}
      <Legend className={styles.legend}>Featured</Legend>
      <PluginList plugins={featuredPlugins.slice(0, 5)} />

      {/* Most popular */}
      <div className={styles.legendContainer}>
        <Legend className={styles.legend}>Most popular</Legend>
        <Button onClick={() => onBrowse({ sortBy: 'popularity' })}>See more</Button>
      </div>
      <PluginList plugins={mostPopular.slice(0, 5)} />

      {/* Recently added */}
      <div className={styles.legendContainer}>
        <Legend className={styles.legend}>Recently added</Legend>
        <Button onClick={() => onBrowse({ sortBy: 'published' })}>See more</Button>
      </div>
      <PluginList plugins={recentlyAdded.slice(0, 5)} />

      {/* Browse by type */}
      <Legend className={cx(styles.legend)}>Browse by type</Legend>
      <Grid>
        <Card onClick={() => onBrowse({ filterBy: 'panel' })}>
          <span className={styles.typeLegend}>
            <PluginTypeIcon typeCode="panel" size={18} />
            &nbsp;Panels
          </span>
        </Card>
        <Card onClick={() => onBrowse({ filterBy: 'datasource' })}>
          <span className={styles.typeLegend}>
            <PluginTypeIcon typeCode="datasource" size={18} />
            &nbsp;Data sources
          </span>
        </Card>
        <Card onClick={() => onBrowse({ filterBy: 'app' })}>
          <span className={styles.typeLegend}>
            <PluginTypeIcon typeCode="app" size={18} />
            &nbsp;Apps
          </span>
        </Card>
      </Grid>
    </>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    legend: css`
      margin-top: ${theme.spacing.xl};
    `,
    legendContainer: css`
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    `,
    typeLegend: css`
      display: flex;
      align-items: center;
      font-size: ${theme.typography.size.lg};
    `,
  };
});
