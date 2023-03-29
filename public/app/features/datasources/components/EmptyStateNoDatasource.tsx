import { css } from '@emotion/css';
import React, { ComponentProps } from 'react';
import { useAsync } from 'react-use';

import { DataSourcePluginMeta, GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Icon, useStyles2 } from '@grafana/ui';
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
              <ul className={styles.datasources}>
                {datasources.map((d) => (
                  <li key={d.id}>
                    <button
                      onClick={() => {
                        reportInteraction('dashboards_connectds_ds_clicked');
                        onAddDatasource(d);
                      }}
                    >
                      <img src={d.info.logos.small} alt="" height="16" width="16" className={styles.logo} />
                      <span className={styles.datasourceName}>{d.name}</span>
                      <Icon name="arrow-right" size="lg" className={styles.arrowIcon} />
                    </button>
                  </li>
                ))}
                <li>
                  <a
                    href="/datasources/new"
                    className={styles.viewAll}
                    onClick={() => reportInteraction('dashboards_connectds_viewall_clicked')}
                  >
                    <span>{t('datasource-onboarding.viewAll', 'View all')}</span>
                    <Icon name="arrow-right" size="lg" />
                  </a>
                </li>
              </ul>
            )}
          </>
        ) : (
          <h4>
            {t('datasource-onboarding.contact-admin', 'Please contact your administrator to configure data sources.')}
          </h4>
        )}
        <button
          onClick={() => {
            reportInteraction('dashboards_connectds_sampledata_clicked');
            onCTAClick?.();
          }}
          className={styles.ctaButton}
        >
          <span>{CTAText}</span>
          <Icon name="arrow-right" size="lg" />
        </button>
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
    title: css({
      textAlign: 'center',
      fontSize: theme.typography.pxToRem(32),
      fontWeight: theme.typography.fontWeightBold,
    }),
    description: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(1),
      maxWidth: '50vw',
      marginBottom: theme.spacing(8),
      color: theme.colors.text.secondary,
    }),
    explanation: css({
      marginBottom: '0px',
      textAlign: 'center',
      fontSize: theme.typography.pxToRem(19),
    }),
    preferredDataSource: css({
      marginBottom: theme.spacing(3),
      fontSize: theme.typography.pxToRem(19),
      fontWeight: theme.typography.fontWeightRegular,
    }),
    datasources: css({
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(${theme.spacing(28)}, 1fr))`,
      gap: theme.spacing(2),
      listStyle: 'none',
      width: '100%',
      maxWidth: theme.spacing(88),

      '> li': {
        display: 'flex',
        alignItems: 'center',
        '> button': {
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: theme.spacing(7),
          gap: theme.spacing(2),
          margin: '0px',
          padding: `calc(${theme.spacing(2)} - 1px)`,
          lineHeight: theme.spacing(3),
          border: `1px solid ${theme.colors.border.weak}`,
          borderRadius: theme.shape.borderRadius(1),
          background: theme.colors.background.primary,
          fontSize: theme.typography.pxToRem(19),
          color: 'inherit',
        },
      },
    }),
    logo: css({
      width: theme.spacing(2),
      height: theme.spacing(2),
      objectFit: 'contain',
    }),
    datasourceName: css({
      marginRight: 'auto',
    }),
    arrowIcon: css({
      color: theme.colors.text.link,
    }),
    viewAll: css({
      display: 'flex',
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing(2),
      lineHeight: theme.spacing(3),
      fontSize: theme.typography.pxToRem(19),
      color: theme.colors.text.link,
      textDecoration: 'underline',
      textUnderlinePosition: 'under',
    }),
    ctaButton: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      margin: '0px',
      marginTop: theme.spacing(8),
      padding: theme.spacing(0),
      border: 'none',
      background: 'inherit',
      fontSize: theme.typography.h6.fontSize,
      color: theme.colors.text.secondary,
    }),
  };
}
