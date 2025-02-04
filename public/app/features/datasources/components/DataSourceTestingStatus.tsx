import { css, cx } from '@emotion/css';
import { HTMLAttributes } from 'react';

import { DataSourceSettings as DataSourceSettingsType, GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { TestingStatus, config } from '@grafana/runtime';
import { AlertVariant, Alert, useTheme2, Link, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { contextSrv } from '../../../core/core';
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
  };
};

const AlertSuccessMessage = ({ title, exploreUrl, dataSourceId, onDashboardLinkClicked }: AlertMessageProps) => {
  const theme = useTheme2();
  const hasTitle = Boolean(title);
  const styles = getStyles(theme, hasTitle);
  const canExploreDataSources = contextSrv.hasAccessToExplore();

  return (
    <div className={styles.content}>
      <Trans i18nKey="data-source-testing-status-page.success-more-details-links">
        Next, you can start to visualize data by{' '}
        <Link
          aria-label={`Create a dashboard`}
          href={`/dashboard/new-with-ds/${dataSourceId}`}
          className="external-link"
          onClick={onDashboardLinkClicked}
        >
          building a dashboard
        </Link>
        , or by querying data in the{' '}
        <Link
          aria-label={`Explore data`}
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
          aria-label={`More details about the error`}
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
      path: location.pathname,
    });
  };
  const styles = useStyles2(getTestingStatusStyles);

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
                />
              ) : null}
              {severity === 'error' && errorDetailsLink ? <ErrorDetailsLink link={String(errorDetailsLink)} /> : null}
              {detailsVerboseMessage ? (
                <details style={{ whiteSpace: 'pre-wrap' }}>{String(detailsVerboseMessage)}</details>
              ) : null}
            </>
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
});
