import React from 'react';

import { DataSourceSettings as DataSourceSettingsType } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { TestingStatus, config } from '@grafana/runtime';
import { AlertVariant } from '@grafana/ui';

import { contextSrv } from '../../../core/core';
import { AccessControlAction } from '../../../types';
import { trackCreateDashboardClicked } from '../tracking';

import { DataSourceConfigAlert } from './DataSourceConfigAlert';

export type Props = {
  testingStatus?: TestingStatus;
  exploreUrl: string;
  dataSource: DataSourceSettingsType;
};

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
        <DataSourceConfigAlert
          severity={severity}
          title={message}
          aria-label={e2eSelectors.pages.DataSource.alert}
          canExploreDataSources={canExploreDataSources}
          exploreUrl={exploreUrl}
          dataSourceId={dataSource.uid}
          onDashboardLinkClicked={onDashboardLinkClicked}
        >
          {testingStatus?.details && (
            <>
              {detailsMessage}
              {detailsVerboseMessage ? (
                <details style={{ whiteSpace: 'pre-wrap' }}>{String(detailsVerboseMessage)}</details>
              ) : null}
            </>
          )}
        </DataSourceConfigAlert>
      </div>
    );
  }

  return null;
}
