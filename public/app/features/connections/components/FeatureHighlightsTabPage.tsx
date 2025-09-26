import { css } from '@emotion/css';
import { useParams } from 'react-router-dom-v5-compat';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Icon, LinkButton, TextLink, useStyles2 } from '@grafana/ui';
import { CloudEnterpriseBadge } from 'app/core/components/Branding/CloudEnterpriseBadge';
import { Page } from 'app/core/components/Page/Page';
import { DataSourceTitle } from 'app/features/datasources/components/DataSourceTitle';
import { EditDataSourceActions } from 'app/features/datasources/components/EditDataSourceActions';
import { useDataSourceInfo } from 'app/features/datasources/components/useDataSourceInfo';
import { useInitDataSourceSettings } from 'app/features/datasources/state/hooks';

import { useDataSourceTabNav } from '../hooks/useDataSourceTabNav';

type FeatureHighlightsTabPageProps = {
  pageName: string;
  title: string;
  header: string;
  items: string[];
  buttonLink: string;
  screenshotPath: string;
};

export function FeatureHighlightsTabPage({
  pageName,
  title,
  header,
  items,
  buttonLink,
  screenshotPath,
}: FeatureHighlightsTabPageProps) {
  const { uid = '' } = useParams<{ uid: string }>();
  useInitDataSourceSettings(uid);

  const { navId, pageNav, dataSourceHeader } = useDataSourceTabNav(pageName);
  const styles = useStyles2(getStyles);

  const info = useDataSourceInfo({
    dataSourcePluginName: pageNav.dataSourcePluginName,
    alertingSupported: dataSourceHeader.alertingSupported,
  });

  return (
    <Page
      navId={navId}
      pageNav={pageNav}
      renderTitle={(title) => <DataSourceTitle title={title} />}
      info={info}
      actions={<EditDataSourceActions uid={uid} />}
    >
      <Page.Contents>
        <div className={styles.container}>
          <div className={styles.content}>
            <div className={styles.badge}>
              <CloudEnterpriseBadge />
            </div>
            <h1 className={styles.title}>{title}</h1>
            <div className={styles.header}>{header}</div>
            <div className={styles.itemsList}>
              {items.map((item) => (
                <div key={item} className={styles.listItem}>
                  <Icon className={styles.icon} name="check" />
                  {item}
                </div>
              ))}
            </div>
            <div className={styles.footer}>
              <Trans i18nKey="connections.feature-highlight-page.footer">
                Create a Grafana Cloud Free account to start using data source permissions. This feature is also
                available with a Grafana Enterprise license.
              </Trans>
              <div>
                <TextLink href="https://grafana.com/products/enterprise/grafana/">
                  <Icon name="external-link-alt" />
                  <Trans i18nKey="connections.feature-highlight-page.footer-link">Learn about Enterprise</Trans>
                </TextLink>
              </div>
            </div>
            <LinkButton className={styles.linkButton} href={buttonLink}>
              <Icon name="external-link-alt" className={styles.buttonIcon} />
              <Trans i18nKey="connections.feature-highlight-page.link-button-label">Create account</Trans>
            </LinkButton>
            <p className={styles.footNote}>
              <Trans i18nKey="connections.feature-highlight-page.foot-note">
                After creating an account, you can easily{' '}
                <TextLink href="https://grafana.com/docs/grafana/latest/administration/migration-guide/cloud-migration-assistant/">
                  migrate this instance to Grafana Cloud
                </TextLink>{' '}
                with our Migration Assistant.
              </Trans>
            </p>
          </div>
          <div className={styles.imageContainer}>
            <img className={styles.image} src={screenshotPath} alt={`${pageName} screenshot`} />
          </div>
        </div>
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    gap: theme.spacing(4),
    alignItems: 'flex-start',
    [theme.breakpoints.down('lg')]: {
      flexDirection: 'column',
    },
  }),
  content: css({
    flex: '0 0 40%',
  }),
  imageContainer: css({
    flex: '0 0 60%',
    display: 'flex',
    [theme.breakpoints.down('lg')]: {
      flex: '1 1 auto',
    },
    padding: `${theme.spacing(5)} 10% 0 ${theme.spacing(5)}`,
  }),
  image: css({
    width: '100%',
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
  }),
  buttonIcon: css({
    marginRight: theme.spacing(1),
  }),
  badge: css({
    marginBottom: theme.spacing(1),
  }),
  title: css({
    marginBottom: theme.spacing(2),
    marginTop: theme.spacing(2),
  }),
  header: css({
    color: theme.colors.text.primary,
  }),

  itemsList: css({
    marginBottom: theme.spacing(3),
    marginTop: theme.spacing(3),
  }),

  listItem: css({
    display: 'flex',
    alignItems: 'flex-start',
    color: theme.colors.text.primary,
    lineHeight: theme.typography.bodySmall.lineHeight,
    marginBottom: theme.spacing(2),
  }),

  linkButton: css({
    marginBottom: theme.spacing(2),
  }),

  footer: css({
    marginBottom: theme.spacing(3),
    marginTop: theme.spacing(3),
  }),

  icon: css({
    marginRight: theme.spacing(1),
    color: theme.colors.success.main,
  }),
  footNote: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
