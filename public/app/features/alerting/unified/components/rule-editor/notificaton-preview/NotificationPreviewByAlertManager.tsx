import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, LoadingPlaceholder, useStyles2, withErrorBoundary } from '@grafana/ui';

import { Stack } from '../../../../../../plugins/datasource/parca/QueryEditor/Stack';
import { Labels } from '../../../../../../types/unified-alerting-dto';

import { NotificationRoute } from './NotificationRoute';
import { useAlertmanagerNotificationRoutingPreview } from './useAlertmanagerNotificationRoutingPreview';
import { AlertManagerNameWithImage } from './useGetAlertManagersSourceNamesAndImage';

function NotificationPreviewByAlertManager({
  alertManagerSource,
  potentialInstances,
  onlyOneAM,
}: {
  alertManagerSource: AlertManagerNameWithImage;
  potentialInstances: Labels[];
  onlyOneAM: boolean;
}) {
  const styles = useStyles2(getStyles);

  const { routesByIdMap, receiversByName, matchingMap, loading, error } = useAlertmanagerNotificationRoutingPreview(
    alertManagerSource.name,
    potentialInstances
  );

  if (error) {
    return (
      <Alert title="Cannot load Alertmanager configuration" severity="error">
        {error.message}
      </Alert>
    );
  }

  if (loading) {
    return <LoadingPlaceholder text="Loading routing preview..." />;
  }

  const matchingPoliciesFound = matchingMap.size > 0;

  return matchingPoliciesFound ? (
    <div className={styles.alertManagerRow}>
      {!onlyOneAM && (
        <Stack direction="row" alignItems="center">
          <div className={styles.firstAlertManagerLine}></div>
          <div className={styles.alertManagerName}>
            {' '}
            Alert manager:
            <img src={alertManagerSource.img} alt="" className={styles.img} />
            {alertManagerSource.name}
          </div>
          <div className={styles.secondAlertManagerLine}></div>
        </Stack>
      )}
      <Stack gap={1} direction="column">
        {Array.from(matchingMap.entries()).map(([routeId, instanceMatches]) => {
          const route = routesByIdMap.get(routeId);
          const receiver = route?.receiver && receiversByName.get(route.receiver);

          if (!route) {
            return null;
          }
          if (!receiver) {
            throw new Error('Receiver not found');
          }
          return (
            <NotificationRoute
              instanceMatches={instanceMatches}
              route={route}
              receiver={receiver}
              key={routeId}
              routesByIdMap={routesByIdMap}
              alertManagerSourceName={alertManagerSource.name}
            />
          );
        })}
      </Stack>
    </div>
  ) : null;
}

// export default because we want to load the component dynamically using React.lazy
// Due to loading of the web worker we don't want to load this component when not necessary
export default withErrorBoundary(NotificationPreviewByAlertManager);

const getStyles = (theme: GrafanaTheme2) => ({
  alertManagerRow: css`
    margin-top: ${theme.spacing(2)};
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(1)};
    width: 100%;
  `,
  firstAlertManagerLine: css`
    height: 1px;
    width: ${theme.spacing(4)};
    background-color: ${theme.colors.secondary.main};
  `,
  alertManagerName: css`
    width: fit-content;
  `,
  secondAlertManagerLine: css`
    height: 1px;
    width: 100%;
    flex: 1;
    background-color: ${theme.colors.secondary.main};
  `,
  img: css`
    margin-left: ${theme.spacing(2)};
    width: ${theme.spacing(3)};
    height: ${theme.spacing(3)};
    margin-right: ${theme.spacing(1)};
  `,
});
