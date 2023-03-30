import { css } from '@emotion/css';
import React, { ComponentProps } from 'react';
import { useAsync } from 'react-use';

import { DataSourcePluginMeta, GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Button, Card, Icon, LinkButton, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { contextSrv } from 'app/core/core';
import { t } from 'app/core/internationalization';
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

interface Props extends Pick<ComponentProps<typeof Page>, 'navId' | 'pageNav'> {
  title: string;
  CTAText: string;
  onCTAClick?: () => void;
  loading?: boolean;
}

export function EmptyStateNoDatasource({ onCTAClick, loading = false, title, CTAText, navId, pageNav }: Props) {
  const styles = useStyles2(getStyles);
  const { backend } = useGrafana();
  const { value: datasources, loading: loadingDatasources } = useAsync(async () => {
    const datasourceMeta: DataSourcePluginMeta[] = await backend.get('/api/plugins', {
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
    <Page navId={navId} pageNav={pageNav} layout={PageLayoutType.Canvas}>
      <div className={styles.wrapper}>
        <div className={styles.panel}>
          <h1 className={styles.title}>{title}</h1>
          <div className={styles.description}>
            <h4 className={styles.explanation}>
              {t('datasource-onboarding.explanation', "To visualize your data, you'll need to connect it first.")}
            </h4>
          </div>
          {contextSrv.hasRole('Admin') ? (
            <>
              <h4 className={styles.preferredDataSource}>
                {t('datasource-onboarding.preferred', 'Connect your preferred data source:')}
              </h4>
              {!loadingDatasources && datasources !== undefined && (
                <div className={styles.datasources}>
                  {datasources.map((d) => (
                    <Card
                      onClick={() => {
                        reportInteraction('dashboards_connectds_ds_clicked');
                        onAddDatasource(d);
                      }}
                      key={d.id}
                    >
                      <Card.Heading>{d.name}</Card.Heading>
                      <Card.Figure className={styles.figure} align="center">
                        <img src={d.info.logos.small} alt="" className={styles.logo} />
                      </Card.Figure>
                    </Card>
                  ))}
                  <LinkButton
                    href="/datasources/new"
                    fill="text"
                    size="lg"
                    className={styles.viewAll}
                    onClick={() => reportInteraction('dashboards_connectds_viewall_clicked')}
                  >
                    <span>{t('datasource-onboarding.viewAll', 'View all')}</span>
                    <Icon name="arrow-right" size="lg" />
                  </LinkButton>
                </div>
              )}
            </>
          ) : (
            <h4>
              {t('datasource-onboarding.contact-admin', 'Please contact your administrator to configure data sources.')}
            </h4>
          )}
          <Button
            onClick={() => {
              reportInteraction('dashboards_connectds_sampledata_clicked');
              onCTAClick?.();
            }}
            variant="secondary"
            fill="text"
            className={styles.ctaButton}
          >
            <span>{CTAText}</span>
            <Icon name="arrow-right" size="lg" />
          </Button>
        </div>
      </div>
    </Page>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
    }),
    panel: css({
      display: 'flex',
      flexDirection: 'column',
      border: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
      padding: theme.spacing(4),
    }),
    title: css({
      //textAlign: 'center',
      fontSize: theme.typography.pxToRem(32),
      fontWeight: theme.typography.fontWeightBold,
    }),
    description: css({
      display: 'flex',
      flexDirection: 'column',
      //alignItems: 'center',
      gap: theme.spacing(1),
      maxWidth: '50vw',
      marginBottom: theme.spacing(8),
      color: theme.colors.text.secondary,
    }),
    explanation: css({
      marginBottom: '0px',
      //textAlign: 'center',
      fontSize: theme.typography.pxToRem(19),
    }),
    preferredDataSource: css({
      marginBottom: theme.spacing(3),
      fontSize: theme.typography.pxToRem(19),
      fontWeight: theme.typography.fontWeightRegular,
    }),
    logo: css({
      //margin: theme.spacing(0, 2),
      width: theme.spacing(5),
      maxHeight: theme.spacing(5),
    }),
    datasources: css({
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(${theme.spacing(28)}, 1fr))`,
      gap: theme.spacing(2),
      listStyle: 'none',
      width: '100%',
      maxWidth: theme.spacing(88),
    }),
    figure: css({
      width: 'inherit',
      //marginRight: '0px',
      '> img': {
        width: theme.spacing(5),
      },
    }),
    arrowIcon: css({
      color: theme.colors.text.link,
    }),
    viewAll: css({
      display: 'flex',
      textDecoration: 'underline',
      alignSelf: 'center',
    }),
    ctaButton: css({
      marginTop: theme.spacing(4),
      color: theme.colors.text.secondary,
    }),
  };
}
