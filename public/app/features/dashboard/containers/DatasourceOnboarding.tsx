import { css, cx } from '@emotion/css';
import React from 'react';
import { useAsync } from 'react-use';

import { DataSourcePluginMeta, GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Icon, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useAddDatasource } from 'app/features/datasources/state';

const topDatasources = [
  'prometheus',
  'mysql',
  'elasticsearch',
  'influxdb',
  'graphite',
  'stackdriver',
  'cloudwatch',
  'grafana-azure-monitor-datasource',
];

export function DatasourceOnboarding({
  onNewDashboard,
  loading = false,
}: {
  onNewDashboard?: () => void;
  loading?: boolean;
}) {
  const styles = useStyles2(getStyles);
  const { value: datasources, loading: loadingDatasources } = useAsync(async () => {
    const datasourceMeta: DataSourcePluginMeta[] = await getBackendSrv().get('/api/plugins', {
      enabled: 1,
      type: 'datasource',
    });

    const byId = datasourceMeta.reduce<Record<string, DataSourcePluginMeta>>((prev, cur) => {
      prev[cur.id] = cur;
      return prev;
    }, {});

    return topDatasources.map((d) => byId[d]);
  }, []);

  const onAddDatasource = useAddDatasource();

  if (loading) {
    return null;
  }

  return (
    <Page
      navId="dashboards/browse"
      pageNav={{ text: 'New dashboard', url: '/dashboard/new' }}
      layout={PageLayoutType.Canvas}
    >
      <div className={styles.wrapper}>
        <h1 className={styles.title}>Welcome to Grafana dashboards!</h1>
        <div className={styles.description}>
          <h4 className={styles.explanation}>{"To visualize your data, you'll need to connect it first."}</h4>
          <a href="#more" className={cx(styles.link, styles.secondary)}>
            Learn more
          </a>
        </div>
        <h4 className={styles.preferredDataSource}>Select your preferred data source:</h4>
        {!loadingDatasources && datasources !== undefined && (
          <ul className={styles.datasources}>
            {datasources.map((d) => (
              <li key={d.id}>
                <button onClick={() => onAddDatasource(d)}>
                  <img
                    src={d.info.logos.small}
                    alt={`Logo for ${d.name} data source`}
                    height="16"
                    width="16"
                    className={styles.logo}
                  />
                  <span style={{ marginRight: 'auto' }}>{d.name}</span>
                  <Icon name="arrow-right" size="lg" className={styles.textLink} />
                </button>
              </li>
            ))}
            <li>
              <a href="/datasources/new" className={styles.viewAll}>
                <span className={styles.link}>View all</span>
                <Icon name="arrow-right" size="lg" />
              </a>
            </li>
          </ul>
        )}
        <button onClick={onNewDashboard} className={styles.createNew}>
          <span>Or set up a new dashboard with sample data</span>
          <Icon name="arrow-right" size="lg" />
        </button>
      </div>
    </Page>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    createNew: css({
      fontSize: theme.typography.h6.fontSize,
      padding: theme.spacing(0),
      margin: '0px',
      marginTop: theme.spacing(8),
      color: theme.colors.text.secondary,
      display: 'flex',
      gap: theme.spacing(1),
      alignItems: 'center',
      background: 'inherit',
      border: 'none',
    }),
    datasources: css({
      display: 'grid',
      gridTemplateRows: 'repeat(3, 1fr)',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: theme.spacing(2),
      listStyle: 'none',
      '> li': {
        display: 'flex',
        alignItems: 'center',
        '> button': {
          height: '100%',
          fontSize: theme.typography.h5.fontSize,
          border: `1px solid ${theme.colors.border.weak}`,
          padding: theme.spacing(2),
          margin: '0px',
          color: 'inherit',
          background: theme.colors.background.primary,

          width: '100%',
          display: 'flex',
          gap: theme.spacing(1),
          alignItems: 'center',
        },
      },
    }),
    description: css({
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing(8),
      display: 'flex',
      alignItems: 'center',
      flexDirection: 'column',
      gap: theme.spacing(1),
      maxWidth: '50vw',
    }),
    explanation: css({
      fontSize: theme.typography.pxToRem(19),
      textAlign: 'center',
      marginBottom: '0px',
    }),
    link: css({
      textDecoration: 'underline',
      textUnderlinePosition: 'under',
      fontSize: theme.typography.h5.fontSize,
    }),
    logo: css({
      width: theme.spacing(2),
      height: theme.spacing(2),
      objectFit: 'contain',
    }),
    preferredDataSource: css({
      fontWeight: theme.typography.fontWeightRegular,
      fontSize: theme.typography.pxToRem(19),
      marginBottom: theme.spacing(3),
    }),
    secondary: css({
      color: theme.colors.text.secondary,
    }),
    textLink: css({
      color: theme.colors.text.link,
    }),
    title: css({
      fontWeight: theme.typography.fontWeightBold,
      fontSize: theme.typography.pxToRem(32),
    }),
    viewAll: css({
      fontSize: theme.typography.h5.fontSize,
      flexGrow: 1,
      padding: theme.spacing(2),
      alignItems: 'center',
      color: theme.colors.text.link,
      display: 'flex',
      justifyContent: 'center',
    }),
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flexGrow: 1,
    }),
  };
}
