import React from 'react';
import { cx, css } from '@emotion/css';

import { dateTimeParse, GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Legend, LinkButton } from '@grafana/ui';

import { PLUGIN_ROOT } from '../constants';
import { Card } from '../components/Card';
import { Grid } from '../components/Grid';
import { PluginList } from '../components/PluginList';
import { SearchField } from '../components/SearchField';
import { PluginTypeIcon } from '../components/PluginTypeIcon';
import { usePlugins } from '../hooks/usePlugins';
import { useHistory } from '../hooks/useHistory';
import { Plugin } from '../types';
import { Page } from 'components/Page';
import { Loader } from 'components/Loader';

export const Discover = () => {
  const { items, isLoading } = usePlugins();
  const history = useHistory();
  const styles = useStyles2(getStyles);

  const onSearch = (q: string) => {
    history.push({ query: { q, tab: 'browse' } });
  };

  const featuredPlugins = items.filter((_) => _.featured > 0);
  featuredPlugins.sort((a: Plugin, b: Plugin) => {
    return b.featured - a.featured;
  });

  const recentlyAdded = items.filter((_) => true);
  recentlyAdded.sort((a: Plugin, b: Plugin) => {
    const at = dateTimeParse(a.createdAt);
    const bt = dateTimeParse(b.createdAt);
    return bt.valueOf() - at.valueOf();
  });

  const mostPopular = items.filter((_) => true);
  mostPopular.sort((a: Plugin, b: Plugin) => {
    return b.popularity - a.popularity;
  });

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Page>
      <SearchField onSearch={onSearch} />
      {/* Featured */}
      <Legend className={styles.legend}>Featured</Legend>
      <PluginList plugins={featuredPlugins.slice(0, 5)} />

      {/* Most popular */}
      <div className={styles.legendContainer}>
        <Legend className={styles.legend}>Most popular</Legend>
        <LinkButton href={`${PLUGIN_ROOT}?tab=browse&sortBy=popularity`}>See more</LinkButton>
      </div>
      <PluginList plugins={mostPopular.slice(0, 5)} />

      {/* Recently added */}
      <div className={styles.legendContainer}>
        <Legend className={styles.legend}>Recently added</Legend>
        <LinkButton href={`${PLUGIN_ROOT}?tab=browse&sortBy=published'`}>See more</LinkButton>
      </div>
      <PluginList plugins={recentlyAdded.slice(0, 5)} />

      {/* Browse by type */}
      <Legend className={cx(styles.legend)}>Browse by type</Legend>
      <Grid>
        <Card
          layout="horizontal"
          href={`${PLUGIN_ROOT}?tab=browse&filterBy=panel`}
          image={<PluginTypeIcon typeCode="panel" size={18} />}
          text={<span className={styles.typeLegend}>&nbsp;Panels</span>}
        />
        <Card
          layout="horizontal"
          href={`${PLUGIN_ROOT}?tab=browse&filterBy=datasource`}
          image={<PluginTypeIcon typeCode="datasource" size={18} />}
          text={<span className={styles.typeLegend}>&nbsp;Data sources</span>}
        />
        <Card
          layout="horizontal"
          href={`${PLUGIN_ROOT}?tab=browse&filterBy=app`}
          image={<PluginTypeIcon typeCode="app" size={18} />}
          text={<span className={styles.typeLegend}>&nbsp;Apps</span>}
        />
      </Grid>
    </Page>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    legend: css`
      margin-top: ${theme.spacing(4)};
    `,
    legendContainer: css`
      align-items: baseline;
      display: flex;
      justify-content: space-between;
    `,
    typeLegend: css`
      align-items: center;
      display: flex;
      font-size: ${theme.typography.h4.fontSize};
    `,
  };
};
