import { groupBy } from 'lodash';

import { t } from '@grafana/i18n';
import { Alert, Box, LoadingPlaceholder, withErrorBoundary } from '@grafana/ui';
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
}: {
  alertManagerSource: AlertManagerDataSource;
  instances: Labels[];
}) {

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
    <Box display="flex" direction="column" gap={1} width="100%">
      <Stack direction="column" gap={0}>
        {Object.entries(contactPointGroups).map(([receiver, resultsForReceiver]) => (
          <ExternalContactPointGroup
            key={receiver}
            name={receiver}
            matchedInstancesCount={resultsForReceiver.length}
            alertmanagerSourceName={alertManagerSource.name}
          >
            <Stack direction="column" gap={0}>
              {resultsForReceiver.map(({ policyTree, matchDetails }) => (
                <InstanceMatch key={matchDetails.labels.join(',')} matchedInstance={matchDetails}  policyTreeSpec={policyTree.expandedSpec} policyTreeMetadata={policyTree.metadata} />
              ))}
            </Stack>
          </ExternalContactPointGroup>
        ))}
      </Stack>
    </Box>
  ) : null;
}

// export default because we want to load the component dynamically using React.lazy
// Due to loading of the web worker we don't want to load this component when not necessary
export default withErrorBoundary(NotificationPreviewByAlertManager);
