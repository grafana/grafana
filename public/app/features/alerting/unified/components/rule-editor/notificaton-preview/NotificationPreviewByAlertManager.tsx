import { css } from '@emotion/css';
import { groupBy } from 'lodash';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, LoadingPlaceholder, useStyles2, withErrorBoundary } from '@grafana/ui';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';

import { Stack } from '../../../../../../plugins/datasource/parca/QueryEditor/Stack';
import { Labels } from '../../../../../../types/unified-alerting-dto';
import { AlertManagerDataSource } from '../../../utils/datasource';

import { ExternalContactPointGroup } from './ContactPointGroup';
import { InstanceMatch } from './NotificationRoute';
import { useAlertmanagerNotificationRoutingPreview } from './useAlertmanagerNotificationRoutingPreview';

const UNKNOWN_RECEIVER = 'unknown';

function NotificationPreviewByAlertManager({
  alertManagerSource,
  instances,
  onlyOneAM,
}: {
  alertManagerSource: AlertManagerDataSource;
  instances: Labels[];
  onlyOneAM: boolean;
}) {
  const styles = useStyles2(getStyles);

  const { treeMatchingResults, isLoading, error } = useAlertmanagerNotificationRoutingPreview(
    alertManagerSource.name,
    instances
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

  if (isLoading) {
    return (
      <LoadingPlaceholder
        text={t(
          'alerting.notification-preview-by-alert-manager.text-loading-routing-preview',
          'Loading routing preview...'
        )}
      />
    );
  }

  const matchingPoliciesFound = treeMatchingResults?.some((result) => result.matchedPolicies.length > 0);

  // Group results by receiver name
  // We need to flatten the structure first to group by receiver
  const flattenedResults = treeMatchingResults?.flatMap(({ labels, matchedPolicies }) => {
    return Array.from(matchedPolicies).map(({ policy, policyTree, matchDetails }) => ({
      labels,
      receiver: policy.receiver || UNKNOWN_RECEIVER,
      policyTree,
      matchDetails,
    }));
  });

  const contactPointGroups = groupBy(flattenedResults, 'receiver');

  return matchingPoliciesFound ? (
    <div className={styles.alertManagerRow}>
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
      <Stack gap={1} direction="column">
        {Object.entries(contactPointGroups).map(([receiver, resultsForReceiver]) => (
          <Stack direction="column" key={receiver}>
            <ExternalContactPointGroup
              name={receiver}
              matchedInstancesCount={resultsForReceiver.length}
              alertmanagerSourceName={alertManagerSource.name}
            >
              <Stack direction="column" gap={0}>
                {resultsForReceiver.map(({ policyTree, matchDetails }) => (
                  <InstanceMatch key={matchDetails.labels.join(',')} matchedInstance={matchDetails} />
                ))}
              </Stack>
            </ExternalContactPointGroup>
          </Stack>
        ))}
      </Stack>
    </div>
  ) : null;
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
