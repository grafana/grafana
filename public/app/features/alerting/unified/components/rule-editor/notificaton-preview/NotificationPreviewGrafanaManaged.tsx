import { css } from '@emotion/css';
import { groupBy } from 'lodash';

import { useMatchAlertInstancesToNotificationPolicies } from '@grafana/alerting/unstable';
import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, LoadingPlaceholder, useStyles2, withErrorBoundary } from '@grafana/ui';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';
import { ObjectMatcher } from 'app/plugins/datasource/alertmanager/types';

import { Stack } from '../../../../../../plugins/datasource/parca/QueryEditor/Stack';
import { Labels } from '../../../../../../types/unified-alerting-dto';
import { AlertManagerDataSource } from '../../../utils/datasource';

import { GrafanaContactPointGroup } from './ContactPointGroup';
import { NotificationRoute } from './NotificationRoute';

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
  const { matchInstancesToPolicies, isLoading, error } = useMatchAlertInstancesToNotificationPolicies();

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

  const treeMatchingResults = matchInstancesToPolicies(instances.map((instance) => Object.entries(instance)));
  const matchingPoliciesFound = treeMatchingResults.some((result) => result.matchedPolicies.size > 0);

  // Group results by receiver name
  // We need to flatten the structure first to group by receiver
  const flattenedResults = treeMatchingResults.flatMap((result) => {
    const entries = Array.from(result.matchedPolicies.entries());
    return entries.map(([policy, instances]) => ({
      treeMetadata: result.treeMetadata,
      expandedTree: result.expandedTree,
      policy,
      instances,
      receiver: policy.receiver ?? UNKNOWN_RECEIVER,
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
        {Object.entries(contactPointGroups).map(([receiver, resultsForReceiver]) =>
          resultsForReceiver.map(({ treeMetadata, expandedTree, policy, instances }) => {
            const matchers =
              policy.matchers?.map<ObjectMatcher>(
                (matcher) => [matcher.label, matcher.type, matcher.value] as ObjectMatcher
              ) ?? [];

            return (
              <Stack direction="column" key={`${treeMetadata.name}-${policy.id}`}>
                <GrafanaContactPointGroup name={receiver}>
                  <NotificationRoute
                    key={policy.id}
                    // every instance has the same route that matched so it's fine to grab the first one
                    isRootRoute={policy.id === expandedTree.id}
                    matchers={matchers}
                    matchedInstances={instances}
                    alertManagerSourceName={alertManagerSource.name}
                  />
                </GrafanaContactPointGroup>
              </Stack>
            );
          })
        )}
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
