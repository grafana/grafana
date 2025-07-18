import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { cloudCardData, ossCardData } from '../components/PageCard/CardData';
import PageCard from '../components/PageCard/PageCard';

const OSS_SUBTITLE = 'connections.connections-home-page.oss-subtitle';
const CLOUD_SUBTITLE = 'connections.connections-home-page.cloud-subtitle';

export default function ConnectionsHomePage() {
  const styles = useStyles2(getStyles);

  const isOSS = config.buildInfo.edition === GrafanaEdition.OpenSource;

  let children = isOSS ? ossCardData : cloudCardData;

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
            <Trans i18nKey={isOSS ? OSS_SUBTITLE : CLOUD_SUBTITLE} />
          </p>
          {children && children.length > 0 && (
            <section className={styles.cardsSection}>
              {children?.map((child, index) => (
                <PageCard
                  key={index}
                  title={child.text}
                  description={child.subTitle}
                  icon={child.icon}
                  url={child.url}
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
