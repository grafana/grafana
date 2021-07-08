import React from 'react';
import { cx, css } from '@emotion/css';

import { dateTimeParse, GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Legend, LinkButton } from '@grafana/ui';
import { locationService } from '@grafana/runtime';

import { Card } from '../components/Card';
import { Grid } from '../components/Grid';
import { PluginList } from '../components/PluginList';
import { SearchField } from '../components/SearchField';
import { PluginTypeIcon } from '../components/PluginTypeIcon';
import { usePlugins } from '../hooks/usePlugins';
import { Plugin } from '../types';
import { Page as PluginPage } from '../components/Page';
import { Loader } from '../components/Loader';
import { Page } from 'app/core/components/Page/Page';

export default function Discover(): JSX.Element | null {
  const { items, isLoading } = usePlugins();
  const styles = useStyles2(getStyles);

  const onSearch = (q: string) => {
    locationService.push({
      pathname: '/plugins/browse',
      search: `?q=${q}`,
    });
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
    return (
      <Page>
        <Page.Contents>
          <Loader />
        </Page.Contents>
      </Page>
    );
  }

  return (
    <Page>
      <Page.Contents>
        <PluginPage>
          <SearchField onSearch={onSearch} />
          {/* Featured */}
          <Legend className={styles.legend}>Featured</Legend>
          <PluginList plugins={featuredPlugins.slice(0, 5)} />

          {/* Most popular */}
          <div className={styles.legendContainer}>
            <Legend className={styles.legend}>Most popular</Legend>
            <LinkButton href={'/plugins/browse?sortBy=popularity'}>See more</LinkButton>
          </div>
          <PluginList plugins={mostPopular.slice(0, 5)} />

          {/* Recently added */}
          <div className={styles.legendContainer}>
            <Legend className={styles.legend}>Recently added</Legend>
            <LinkButton href={'/plugins/browse?sortBy=published'}>See more</LinkButton>
          </div>
          <PluginList plugins={recentlyAdded.slice(0, 5)} />

          {/* Browse by type */}
          <Legend className={cx(styles.legend)}>Browse by type</Legend>
          <Grid>
            <Card
              layout="horizontal"
              href={'/plugins/browse?filterBy=panel'}
              image={<PluginTypeIcon typeCode="panel" size={18} />}
              text={<span className={styles.typeLegend}>&nbsp;Panels</span>}
            />
            <Card
              layout="horizontal"
              href={'/plugins/browse?filterBy=datasource'}
              image={<PluginTypeIcon typeCode="datasource" size={18} />}
              text={<span className={styles.typeLegend}>&nbsp;Data sources</span>}
            />
            <Card
              layout="horizontal"
              href={'/plugins/browse?filterBy=app'}
              image={<PluginTypeIcon typeCode="app" size={18} />}
              text={<span className={styles.typeLegend}>&nbsp;Apps</span>}
            />
          </Grid>
        </PluginPage>
      </Page.Contents>
    </Page>
  );
}

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
