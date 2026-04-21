import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { Alert, EmptyState, LoadingPlaceholder, Stack } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { ContactPointsList } from 'app/features/alerting/unified/components/contact-points/ContactPoints';
import { useContactPointsWithStatus } from 'app/features/alerting/unified/components/contact-points/useContactPoints';
import { useCanViewContactPoints } from 'app/features/alerting/unified/hooks/useAbilities';
import { AlertmanagerProvider, useAlertmanager } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { shouldUseK8sApi } from 'app/features/alerting/unified/utils/k8s/utils';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';
import { AccessControlAction } from 'app/types/accessControl';

const DEFAULT_PAGE_SIZE = 10;

export interface ContactPointDrawerProps {
  receiverName: string;
  /** When set, Edit on a contact point opens the stacked edit drawer instead of the full page. */
  onEditContactPoint?: (receiverResourceName: string, displayTitle?: string) => void;
}

/**
 * Contact point list filtered by receiver name, for use inside the instance details drawer.
 * Mirrors the data and list behavior of the contact points tab on the notifications page.
 */
export function ContactPointDrawer({ receiverName, onEditContactPoint }: ContactPointDrawerProps) {
  const canViewContactPoints = useCanViewContactPoints();

  if (!canViewContactPoints) {
    return (
      <Alert
        severity="warning"
        title={t('alerting.triage.contact-point-drawer.no-permission-title', 'No permission to view contact points')}
      >
        {t(
          'alerting.triage.contact-point-drawer.no-permission-description',
          'You do not have permission to view contact points.'
        )}
      </Alert>
    );
  }

  return (
    <AlertmanagerProvider accessType="instance">
      <ContactPointDrawerBody receiverName={receiverName} onEditContactPoint={onEditContactPoint} />
    </AlertmanagerProvider>
  );
}

function ContactPointDrawerBody({ receiverName, onEditContactPoint }: ContactPointDrawerProps) {
  const { selectedAlertmanager } = useAlertmanager();

  const fetchPolicies = useMemo(
    () => (selectedAlertmanager ? !shouldUseK8sApi(selectedAlertmanager) : false),
    [selectedAlertmanager]
  );
  const fetchStatuses = contextSrv.hasPermission(AccessControlAction.AlertingNotificationsRead);

  const { isLoading, error, contactPoints } = useContactPointsWithStatus({
    alertmanager: selectedAlertmanager ?? '',
    fetchPolicies,
    fetchStatuses,
    skip: !selectedAlertmanager,
  });

  if (!selectedAlertmanager) {
    return (
      <Alert
        severity="warning"
        title={t('alerting.triage.contact-point-drawer.no-alertmanager-title', 'No alert manager')}
      >
        {t(
          'alerting.triage.contact-point-drawer.no-alertmanager-description',
          'No alert manager is available for this session.'
        )}
      </Alert>
    );
  }

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
          search={receiverName}
          pageSize={DEFAULT_PAGE_SIZE}
          onEditContactPoint={onEditContactPoint}
        />
      )}
    </Stack>
  );
}
