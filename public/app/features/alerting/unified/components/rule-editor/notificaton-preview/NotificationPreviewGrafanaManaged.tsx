import { groupBy } from 'lodash';
import { useMemo } from 'react';

import { useNotificationPolicyPreview } from '@grafana/alerting/unstable';
import { t } from '@grafana/i18n';
import { Alert, Box, LoadingPlaceholder, Stack, withErrorBoundary } from '@grafana/ui';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';

import { type Labels } from '../../../../../../types/unified-alerting-dto';
import { type AlertManagerDataSource } from '../../../utils/datasource';

import { GrafanaContactPointGroup } from './ContactPointGroup';
import { InstanceMatch } from './NotificationRoute';

const UNKNOWN_RECEIVER = 'unknown';

function NotificationPreviewGrafanaManaged({
  alertManagerSource,
  instances,
  policyName,
}: {
  alertManagerSource: AlertManagerDataSource;
  instances: Labels[];
  policyName?: string;
}) {
  const labelSets = useMemo(() => instances.map((instance) => Object.entries(instance)), [instances]);
  const { status, results, error } = useNotificationPolicyPreview(policyName, labelSets);

  if (status === 'error' || status === 'notFound') {
    const title = t('alerting.notification-preview.error', 'Could not load routing preview for {{alertmanager}}', {
      alertmanager: alertManagerSource.name,
    });
    return (
      <Alert title={title} severity="error">
        {status === 'error'
          ? stringifyErrorLike(error)
          : t('alerting.notification-preview.policy-not-found', 'Notification policy "{{policyName}}" was not found.', {
              policyName,
            })}
      </Alert>
    );
  }

  if (status === 'resolving') {
    return (
      <LoadingPlaceholder
        text={t(
          'alerting.notification-preview-by-alert-manager.text-loading-routing-preview',
          'Loading routing preview...'
        )}
      />
    );
  }

  const matchingPoliciesFound = results.some((result) => result.matchedRoutes.length > 0);

  // Group results by receiver name
  // We need to flatten the structure first to group by receiver
  const flattenedResults = results.flatMap(({ labels, matchedRoutes }) => {
    return matchedRoutes.map(({ receiver, treeName, matchingJourney }) => ({
      labels,
      receiver: receiver || UNKNOWN_RECEIVER,
      treeName,
      matchingJourney,
    }));
  });

  const contactPointGroups = groupBy(flattenedResults, 'receiver');

  return matchingPoliciesFound ? (
    <Box display="flex" direction="column" gap={1} width="100%">
      <Stack direction="column" gap={0}>
        {Object.entries(contactPointGroups).map(([receiver, resultsForReceiver]) => (
          <GrafanaContactPointGroup key={receiver} name={receiver} matchedInstancesCount={resultsForReceiver.length}>
            <Stack direction="column" gap={0}>
              {resultsForReceiver.map(({ labels, treeName, matchingJourney }) => (
                <InstanceMatch
                  key={labels.join(',')}
                  matchedInstance={{ labels, matchingJourney }}
                  policyTreeMetadata={{ name: treeName }}
                />
              ))}
            </Stack>
          </GrafanaContactPointGroup>
        ))}
      </Stack>
    </Box>
  ) : null;
}

// export default because we want to load the component dynamically using React.lazy
export default withErrorBoundary(NotificationPreviewGrafanaManaged);
