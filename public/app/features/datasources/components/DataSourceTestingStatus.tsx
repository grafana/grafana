import { css, cx } from '@emotion/css';
import React, { HTMLAttributes } from 'react';

import { DataSourceSettings as DataSourceSettingsType, GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { TestingStatus, config } from '@grafana/runtime';
import { AlertVariant, Alert, useTheme2, Link } from '@grafana/ui';

import { contextSrv } from '../../../core/core';
import { AccessControlAction } from '../../../types';
import { trackCreateDashboardClicked } from '../tracking';

export type Props = {
  testingStatus?: TestingStatus;
  exploreUrl: string;
  dataSource: DataSourceSettingsType;
};

export const createDashboardLinkText = `creating a dashboard`;
export const exploreDataLinkText = `exploring the data`;

interface AlertMessageProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  severity?: AlertVariant;
  exploreUrl: string;
  canExploreDataSources: boolean;
  dataSourceId: string;
  onDashboardLinkClicked: () => void;
}

const getStyles = (theme: GrafanaTheme2, hasTitle: boolean) => {
  return {
    content: css`
      color: ${theme.colors.text.secondary};
      padding-top: ${hasTitle ? theme.spacing(1) : 0};
      max-height: 50vh;
      overflow-y: auto;
    `,
    link: css`
      color: ${theme.colors.primary.text};
      text-decoration: underline;
    `,
    disabled: css`
      pointer-events: none;
      color: ${theme.colors.text.secondary};
    `,
  };
};

const AlertSuccessMessage = ({
  title,
  exploreUrl,
  canExploreDataSources,
  dataSourceId,
  onDashboardLinkClicked,
}: AlertMessageProps) => {
  const theme = useTheme2();
  const hasTitle = Boolean(title);
  const styles = getStyles(theme, hasTitle);

  return (
    <div className={styles.content}>
      Next, you can analyze the data by &nbsp;
      <Link
        aria-label={`Create a dashboard`}
        href={`../../dashboard/new-with-ds/${dataSourceId}`}
        className={styles.link}
        onClick={onDashboardLinkClicked}
      >
        {createDashboardLinkText}
      </Link>
      , or &nbsp;
      <Link
        aria-label={`Explore data`}
        className={cx(styles.link, {
          [`${styles.disabled}`]: !canExploreDataSources,
          'test-disabled': !canExploreDataSources,
        })}
        href={exploreUrl}
      >
        {exploreDataLinkText}
      </Link>
      .
    </div>
  );
};

AlertSuccessMessage.displayName = 'AlertSuccessMessage';

export function DataSourceTestingStatus({ testingStatus, exploreUrl, dataSource }: Props) {
  const severity = testingStatus?.status ? (testingStatus?.status as AlertVariant) : 'error';
  const message = testingStatus?.message;
  const detailsMessage = testingStatus?.details?.message;
  const detailsVerboseMessage = testingStatus?.details?.verboseMessage;
  const canExploreDataSources = contextSrv.hasPermission(AccessControlAction.DataSourcesExplore);
  const onDashboardLinkClicked = () => {
    trackCreateDashboardClicked({
      grafana_version: config.buildInfo.version,
      datasource_uid: dataSource.uid,
      plugin_name: dataSource.typeName,
      path: location.pathname,
    });
  };

  if (message) {
    return (
      <div className="gf-form-group p-t-2">
        <Alert severity={severity} title={message} aria-label={e2eSelectors.pages.DataSource.alert}>
          {testingStatus?.details && (
            <>
              {detailsMessage}
              {severity === 'success' ? (
                <AlertSuccessMessage
                  title={message}
                  canExploreDataSources={canExploreDataSources}
                  exploreUrl={exploreUrl}
                  dataSourceId={dataSource.uid}
                  onDashboardLinkClicked={onDashboardLinkClicked}
                />
              ) : null}
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
