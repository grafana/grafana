import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { Alert, EmptyState, LoadingPlaceholder, Stack } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { ContactPointsList } from 'app/features/alerting/unified/components/contact-points/ContactPoints';
import { useContactPointsWithStatus } from 'app/features/alerting/unified/components/contact-points/useContactPoints';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { shouldUseK8sApi } from 'app/features/alerting/unified/utils/k8s/utils';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';
import { AccessControlAction } from 'app/types/accessControl';

const DEFAULT_PAGE_SIZE = 10;

export interface ContactPointDrawerProps {
  listSearchQuery: string;
  /** Optional K8s `metadata.name` hint; used to prefer an exact row from the fetched list when available. */
  receiverResourceId?: string;
  onEditContactPoint?: (receiverResourceName: string, displayTitle?: string) => void;
}

export function ContactPointDrawer({
  listSearchQuery,
  receiverResourceId,
  onEditContactPoint,
}: ContactPointDrawerProps) {
  const fetchPolicies = useMemo(() => !shouldUseK8sApi(GRAFANA_RULES_SOURCE_NAME), []);
  const fetchStatuses = contextSrv.hasPermission(AccessControlAction.AlertingNotificationsRead);

  const { isLoading, error, contactPoints } = useContactPointsWithStatus({
    alertmanager: GRAFANA_RULES_SOURCE_NAME,
    fetchPolicies,
    fetchStatuses,
  });

  const forResourceId = useMemo(
    () => (receiverResourceId ? contactPoints.find((cp) => cp.id === receiverResourceId) : undefined),
    [contactPoints, receiverResourceId]
  );

  const listContactPoints = forResourceId ? [forResourceId] : contactPoints;
  const searchForList = forResourceId ? undefined : listSearchQuery;

  if (isLoading) {
    return <LoadingPlaceholder text={t('alerting.contact-points-tab.text-loading', 'Loading...')} />;
  }

  if (error) {
    return (
      <Alert
        title={t('alerting.contact-points-tab.title-failed-to-fetch-contact-points', 'Failed to fetch contact points')}
      >
        {stringifyErrorLike(error)}
      </Alert>
    );
  }

  if (contactPoints.length === 0) {
    return (
      <EmptyState
        variant="not-found"
        message={t('alerting.contact-points.empty-state.title', "You don't have any contact points yet")}
      />
    );
  }

  return (
    <Stack direction="column" gap={1}>
      <ContactPointsList
        contactPoints={listContactPoints}
        search={searchForList}
        pageSize={DEFAULT_PAGE_SIZE}
        onEditContactPoint={onEditContactPoint}
        fallbackWhenSearchUnmatched={!forResourceId}
      />
    </Stack>
  );
}
