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
  /**
   * Search string for the embedded list (usually the contact point title shown in the timeline / rule).
   * This filters rows; it is not necessarily the same string as `receiverResourceName` in `onEditContactPoint`.
   */
  listSearchQuery: string;
  /** When set, Edit on a contact point opens the stacked edit drawer instead of the full page. */
  onEditContactPoint?: (receiverResourceName: string, displayTitle?: string) => void;
}

/**
 * Contact point list filtered by name, for use inside the instance details drawer.
 * Alert Activity uses Grafana managed alert rules only, so this always loads Grafana-managed contact points.
 * Callers should only open this when the user can view contact points (see `useCanViewContactPoints` in the parent).
 */
export function ContactPointDrawer({ listSearchQuery, onEditContactPoint }: ContactPointDrawerProps) {
  const fetchPolicies = useMemo(() => !shouldUseK8sApi(GRAFANA_RULES_SOURCE_NAME), []);
  const fetchStatuses = contextSrv.hasPermission(AccessControlAction.AlertingNotificationsRead);

  const { isLoading, error, contactPoints } = useContactPointsWithStatus({
    alertmanager: GRAFANA_RULES_SOURCE_NAME,
    fetchPolicies,
    fetchStatuses,
  });

  if (isLoading) {
    return <LoadingPlaceholder text={t('alerting.contact-points-tab.text-loading', 'Loading...')} />;
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
      {error ? (
        <Alert
          title={t(
            'alerting.contact-points-tab.title-failed-to-fetch-contact-points',
            'Failed to fetch contact points'
          )}
        >
          {stringifyErrorLike(error)}
        </Alert>
      ) : (
        <ContactPointsList
          contactPoints={contactPoints}
          search={listSearchQuery}
          pageSize={DEFAULT_PAGE_SIZE}
          onEditContactPoint={onEditContactPoint}
        />
      )}
    </Stack>
  );
}
