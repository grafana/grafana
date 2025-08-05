import { css, cx } from '@emotion/css';
import { HTMLAttributes } from 'react';

import { DataSourceSettings as DataSourceSettingsType, GrafanaTheme2, PluginExtensionPoints, PluginExtensionLink } from '@grafana/data';
import { sanitizeUrl } from '@grafana/data/internal';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { TestingStatus, config, usePluginLinks } from '@grafana/runtime';
import { AlertVariant, Alert, useTheme2, Link, useStyles2 } from '@grafana/ui';

import { contextSrv } from '../../../core/core';
import { ALLOWED_DATASOURCE_EXTENSION_PLUGINS } from '../constants';
import { trackCreateDashboardClicked } from '../tracking';

export type Props = {
  testingStatus?: TestingStatus;
  exploreUrl: string;
  dataSource: DataSourceSettingsType;
};

interface AlertMessageProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  severity?: AlertVariant;
  exploreUrl: string;
  dataSourceId: string;
  onDashboardLinkClicked: () => void;
  extensionLinks?: PluginExtensionLink[];
}

const getStyles = (theme: GrafanaTheme2, hasTitle: boolean) => {
  return {
    content: css({
      color: theme.colors.text.secondary,
      paddingTop: hasTitle ? theme.spacing(1) : 0,
      maxHeight: '50vh',
      overflowY: 'auto',
    }),
    disabled: css({
      pointerEvents: 'none',
      color: theme.colors.text.secondary,
    }),
    extensionLinks: css({
      display: 'inline-flex',
      marginTop: theme.spacing(0.5),
      gap: theme.spacing(1),
    }),
  };
};

const AlertSuccessMessage = ({ title, exploreUrl, dataSourceId, onDashboardLinkClicked, extensionLinks = [] }: AlertMessageProps) => {
  const theme = useTheme2();

  const hasTitle = Boolean(title);
  const styles = getStyles(theme, hasTitle);
  const canExploreDataSources = contextSrv.hasAccessToExplore();

  return (
    <div className={styles.content}>
      <Trans i18nKey="data-source-testing-status-page.success-more-details-links">
        Next, you can start to visualize data by{' '}
        <Link
          aria-label={t('datasources.alert-success-message.aria-label-create-a-dashboard', 'Create a dashboard')}
          href={`/dashboard/new-with-ds/${dataSourceId}`}
          className="external-link"
          onClick={onDashboardLinkClicked}
        >
          building a dashboard
        </Link>
        , or by querying data in the{' '}
        <Link
          aria-label={t('datasources.alert-success-message.aria-label-explore-data', 'Explore data')}
          className={cx('external-link', {
            [`${styles.disabled}`]: !canExploreDataSources,
            'test-disabled': !canExploreDataSources,
          })}
          href={exploreUrl}
        >
          Explore view
        </Link>
        .
      </Trans>

      {/* Extension links for allowed datasource extension plugins */}
      {extensionLinks.length > 0 && (
        <div className={styles.extensionLinks}>
          <Trans i18nKey="data-source-testing-status-page.success-more-details-links-extensions">
            You can also explore data with the following extensions:
          </Trans>
          {extensionLinks.map((link) => (
            <Link
              key={link.id}
              href={link.path || '#'}
              title={link.description}
              className='external-link'
              onClick={'onClick' in link ? link.onClick : undefined}
            >
              {link.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

AlertSuccessMessage.displayName = 'AlertSuccessMessage';

interface ErrorDetailsLinkProps extends HTMLAttributes<HTMLDivElement> {
  link?: string;
}

const ErrorDetailsLink = ({ link }: ErrorDetailsLinkProps) => {
  const theme = useTheme2();

  const styles = {
    content: css({
      color: theme.colors.text.secondary,
      paddingBlock: theme.spacing(1),
      maxHeight: '50vh',
      overflowY: 'auto',
    }),
  };
  if (!link) {
    return <></>;
  }
  const isValidUrl = /^(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/.test(link);
  if (!isValidUrl) {
    return <></>;
  }
  return (
    <div className={styles.content}>
      <Trans i18nKey="data-source-testing-status-page.error-more-details-link">
        Click{' '}
        <Link
          aria-label={t(
            'datasources.error-details-link.aria-label-more-details-about-the-error',
            'More details about the error'
          )}
          className={'external-link'}
          href={link}
          target="_blank"
          rel="noreferrer"
        >
          here
        </Link>{' '}
        to learn more about this error.
      </Trans>
    </div>
  );
};

ErrorDetailsLink.displayName = 'ErrorDetailsLink';

const alertVariants = new Set(['success', 'info', 'warning', 'error']);
const isAlertVariant = (str: string): str is AlertVariant => alertVariants.has(str);
const getAlertVariant = (status: string): AlertVariant => {
  if (status.toLowerCase() === 'ok') {
    return 'success';
  }
  return isAlertVariant(status) ? status : 'info';
};

export function DataSourceTestingStatus({ testingStatus, exploreUrl, dataSource }: Props) {
  const severity = getAlertVariant(testingStatus?.status ?? 'error');
  const message = testingStatus?.message;
  const detailsMessage = testingStatus?.details?.message;
  const detailsVerboseMessage = testingStatus?.details?.verboseMessage;
  const errorDetailsLink = testingStatus?.details?.errorDetailsLink;
  const onDashboardLinkClicked = () => {
    trackCreateDashboardClicked({
      grafana_version: config.buildInfo.version,
      datasource_uid: dataSource.uid,
      plugin_name: dataSource.typeName,
      path: window.location.pathname,
    });
  };
  const styles = useStyles2(getTestingStatusStyles);

  const { links: allStatusLinks } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.DataSourceConfigStatus,
    context: {
      dataSource: {
        type: dataSource.type,
        uid: dataSource.uid,
        name: dataSource.name,
        typeName: dataSource.typeName,
      },
      testingStatus,
      severity,
    },
    limitPerPlugin: 1,
  });

  // Existing error-specific extensions (backward compatibility)
  const { links: allErrorLinks } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.DataSourceConfigErrorStatus,
    context: {
      dataSource: {
        type: dataSource.type,
        uid: dataSource.uid,
        name: dataSource.name,
      },
      testingStatus,
    },
    limitPerPlugin: 3,
  });

  // Filter to only allow grafana-owned plugins
  const statusLinks = allStatusLinks.filter((link) => ALLOWED_DATASOURCE_EXTENSION_PLUGINS.includes(link.pluginId));
  const errorLinks = allErrorLinks.filter((link) => ALLOWED_DATASOURCE_EXTENSION_PLUGINS.includes(link.pluginId));

    // Combine links: show error-specific only for errors, status-general for all
  const extensionLinks = severity === 'error' ? [...statusLinks, ...errorLinks] : statusLinks;

  if (message) {
    return (
      <div className={cx('gf-form-group', styles.container)}>
        <Alert severity={severity} title={message} data-testid={e2eSelectors.pages.DataSource.alert}>
          {testingStatus?.details && (
            <>
              {detailsMessage ? <>{String(detailsMessage)}</> : null}
              {severity === 'success' ? (
                <AlertSuccessMessage
                  title={message}
                  exploreUrl={exploreUrl}
                  dataSourceId={dataSource.uid}
                  onDashboardLinkClicked={onDashboardLinkClicked}
                  extensionLinks={extensionLinks}
                />
              ) : null}
              {severity === 'error' && errorDetailsLink ? <ErrorDetailsLink link={String(errorDetailsLink)} /> : null}
              {detailsVerboseMessage ? (
                <details style={{ whiteSpace: 'pre-wrap' }}>{String(detailsVerboseMessage)}</details>
              ) : null}
            </>
          )}
          {extensionLinks.length > 0 && (
            <div className={styles.linksContainer}>
              {extensionLinks.map((link) => {
                return (
                  <a
                    key={link.id}
                    href={link.path ? sanitizeUrl(link.path) : undefined}
                    onClick={link.onClick}
                    className={styles.pluginLink}
                    title={link.description}
                  >
                    {link.title}
                  </a>
                );
              })}
            </div>
          )}
        </Alert>
      </div>
    );
  }

  return null;
}

const getTestingStatusStyles = (theme: GrafanaTheme2) => ({
  container: css({
    paddingTop: theme.spacing(3),
  }),
  moreLink: css({
    marginBlock: theme.spacing(1),
  }),
  linksContainer: css({
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: theme.spacing(1),
  }),
  pluginLink: css({
    color: theme.colors.text.link,
    textDecoration: 'none',
    marginLeft: theme.spacing(2),
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    '&:hover': {
      color: theme.colors.text.primary,
      textDecoration: 'underline',
    },
    '&:first-child': {
      marginLeft: 0,
    },
  }),
});
