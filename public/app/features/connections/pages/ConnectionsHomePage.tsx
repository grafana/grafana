import { css } from '@emotion/css';

import { type GrafanaTheme2, type IconName, isIconName } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useSelector } from 'app/types/store';

import { getConnectionsCardMetadata } from '../components/PageCard/CardMetadata';
import PageCard from '../components/PageCard/PageCard';

const FALLBACK_ICON: IconName = 'plug';

function resolveIcon(metaIcon: IconName | undefined, navIcon: string | undefined): IconName {
  if (metaIcon) {
    return metaIcon;
  }
  if (navIcon && isIconName(navIcon)) {
    return navIcon;
  }
  return FALLBACK_ICON;
}

export default function ConnectionsHomePage() {
  const styles = useStyles2(getStyles);

  const isOnPrem = !config.pluginAdminExternalManageEnabled;
  const cardMetadata = getConnectionsCardMetadata(isOnPrem);
  const navIndex = useSelector((state) => state.navIndex);
  const cardsData = (navIndex['connections']?.children ?? [])
    .filter((item) => item.url)
    .map((item) => {
      const meta = cardMetadata[item.url!];
      return {
        ...item,
        text: meta?.text ?? item.text,
        icon: resolveIcon(meta?.icon, item.icon),
        subTitle: meta?.subTitle ?? item.subTitle ?? '',
      };
    });

  return (
    <Page
      navId="connections"
      pageNav={{
        text: '',
        active: true,
      }}
    >
      <Page.Contents>
        <div className={styles.centeredContainer}>
          <h1 className={styles.mainTitle}>
            <Trans i18nKey="connections.connections-home-page.welcome-to-connections">Welcome to Connections</Trans>
          </h1>
          <p className={styles.subTitle}>
            {isOnPrem ? (
              <Trans i18nKey="connections.oss.connections-home-page.subtitle">
                Manage your data source connections in one place. Use this page to add a new data source or manage your
                existing connections.
              </Trans>
            ) : (
              <Trans i18nKey="connections.cloud.connections-home-page.subtitle">
                Connect your infrastructure to Grafana Cloud using data sources, integrations and apps. Use this page to
                add to manage everything from data ingestion to private connections and telemetry pipelines.
              </Trans>
            )}
          </p>
          {cardsData.length > 0 && (
            <section className={styles.cardsSection}>
              {cardsData.map((child, index) => (
                <PageCard
                  key={child.id ?? index}
                  title={child.text}
                  description={child.subTitle}
                  icon={child.icon}
                  url={child.url!}
                  index={index}
                />
              ))}
            </section>
          )}
        </div>
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  mainTitle: css({
    textAlign: 'left',
    [theme.breakpoints.up('sm')]: {
      textAlign: 'center',
    },
  }),
  subTitle: css({
    color: theme.colors.text.secondary,
    textAlign: 'left',
    [theme.breakpoints.up('sm')]: {
      textAlign: 'center',
      maxWidth: theme.spacing(119),
    },
  }),
  cardsSection: css({
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: theme.spacing(4),
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
    width: '100%',
    [theme.breakpoints.up('sm')]: {
      justifyContent: 'center',
      paddingTop: theme.spacing(6),
      paddingBottom: theme.spacing(6),
    },
  }),
  centeredContainer: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    [theme.breakpoints.up('sm')]: {
      alignItems: 'center',
    },
  }),
});
