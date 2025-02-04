import { css } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, useStyles2, withErrorBoundary } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';

import { Stack } from '../../../../../../plugins/datasource/parca/QueryEditor/Stack';
import { Labels } from '../../../../../../types/unified-alerting-dto';
import { AlertManagerDataSource } from '../../../utils/datasource';

import { NotificationRoute } from './NotificationRoute';
import { useAlertmanagerNotificationRoutingPreview } from './useAlertmanagerNotificationRoutingPreview';

function NotificationPreviewByAlertManager({
  alertManagerSource,
  potentialInstances,
  onlyOneAM,
}: {
  alertManagerSource: AlertManagerDataSource;
  potentialInstances: Labels[];
  onlyOneAM: boolean;
}) {
  const styles = useStyles2(getStyles);

  const { routesByIdMap, receiversByName, matchingMap, loading, error } = useAlertmanagerNotificationRoutingPreview(
    alertManagerSource.name,
    potentialInstances
  );

  if (error) {
    const title = t('alerting.notification-preview.error', 'Could not load routing preview for {{alertmanager}}', {
      alertmanager: alertManagerSource.name,
    });
    return (
      <Alert title={title} severity="error">
        {stringifyErrorLike(error)}
      </Alert>
    );
  }

  const matchingPoliciesFound = matchingMap.size > 0;
  if (!loading && !matchingPoliciesFound) {
    return 'No matching instances found';
  }

  return (
    <div className={styles.alertManagerRow}>
      {/* when several Alertmanagers are configured, show the header */}
      {!onlyOneAM && (
        <Stack direction="row" alignItems="center">
          <div className={styles.firstAlertManagerLine} />
          <div className={styles.alertManagerName}>
            <Trans i18nKey="alerting.notification-preview.alertmanager">Alertmanager:</Trans>
            <img src={alertManagerSource.imgUrl} alt="" className={styles.img} />
            {alertManagerSource.name}
          </div>
          <div className={styles.secondAlertManagerLine} />
        </Stack>
      )}

      {loading ? (
        <>
          <Skeleton width={250} height={16} containerTestId="loading-preview-instances" />
        </>
      ) : (
        <Stack gap={0} direction="column">
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
      )}
    </div>
  );
}

// export default because we want to load the component dynamically using React.lazy
// Due to loading of the web worker we don't want to load this component when not necessary
export default withErrorBoundary(NotificationPreviewByAlertManager);

const getStyles = (theme: GrafanaTheme2) => ({
  alertManagerRow: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    width: '100%',
  }),
  firstAlertManagerLine: css({
    height: '1px',
    width: theme.spacing(4),
    backgroundColor: theme.colors.secondary.main,
  }),
  alertManagerName: css({
    width: 'fit-content',
  }),
  secondAlertManagerLine: css({
    height: '1px',
    width: '100%',
    flex: 1,
    backgroundColor: theme.colors.secondary.main,
  }),
  img: css({
    marginLeft: theme.spacing(2),
    width: theme.spacing(3),
    height: theme.spacing(3),
    marginRight: theme.spacing(1),
  }),
});
