import { Trans, t } from '@grafana/i18n';
import { Alert, Button, EmptyState, LinkButton, LoadingPlaceholder, Pagination, Stack } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { shouldUseK8sApi } from 'app/features/alerting/unified/utils/k8s/utils';
import { makeAMLink, stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';
import { AccessControlAction } from 'app/types/accessControl';

import { AlertmanagerAction, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { usePagination } from '../../hooks/usePagination';
import { useNotificationConfigNav } from '../../navigation/useNotificationConfigNav';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { isExtraConfig } from '../../utils/alertmanager/extraConfigs';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';
import { GrafanaAlertmanagerWarning } from '../GrafanaAlertmanagerWarning';

import { ContactPoint } from './ContactPoint';
import { ContactPointsFilter } from './components/ContactPointsFilter';
import { GlobalConfigAlert } from './components/GlobalConfigAlert';
import { useContactPointsWithStatus } from './useContactPoints';
import { useContactPointsSearch } from './useContactPointsSearch';
import { ALL_CONTACT_POINTS, useExportContactPoint } from './useExportContactPoint';
import { ContactPointWithMetadata } from './utils';

const DEFAULT_PAGE_SIZE = 10;

const ContactPointsTab = () => {
  const { selectedAlertmanager } = useAlertmanager();
  const [queryParams] = useURLSearchParams();

  // If we're using the K8S API, then we don't need to fetch the policies info within the hook,
  // as we get metadata about this from the API
  const fetchPolicies = !shouldUseK8sApi(selectedAlertmanager!);
  // User may have access to list contact points, but not permission to fetch the status endpoint
  const fetchStatuses = contextSrv.hasPermission(AccessControlAction.AlertingNotificationsRead);

  const { isLoading, error, contactPoints } = useContactPointsWithStatus({
    alertmanager: selectedAlertmanager!,
    fetchPolicies,
    fetchStatuses,
  });

  const [addContactPointSupported, addContactPointAllowed] = useAlertmanagerAbility(
    AlertmanagerAction.CreateContactPoint
  );
  const [exportContactPointsSupported, exportContactPointsAllowed] = useAlertmanagerAbility(
    AlertmanagerAction.ExportContactPoint
  );

  const [ExportDrawer, showExportDrawer] = useExportContactPoint();

  const search = queryParams.get('search');

  if (isLoading) {
    return <LoadingPlaceholder text={t('alerting.contact-points-tab.text-loading', 'Loading...')} />;
  }

  const isGrafanaManagedAlertmanager = selectedAlertmanager === GRAFANA_RULES_SOURCE_NAME;

  if (contactPoints.length === 0) {
    return (
      <EmptyState
        variant={addContactPointAllowed ? 'call-to-action' : 'not-found'}
        button={
          addContactPointAllowed && (
            <LinkButton
              href={makeAMLink('/alerting/notifications/receivers/new', selectedAlertmanager)}
              icon="plus"
              size="lg"
            >
              <Trans i18nKey="alerting.contact-points.create">Create contact point</Trans>
            </LinkButton>
          )
        }
        message={t('alerting.contact-points.empty-state.title', "You don't have any contact points yet")}
      />
    );
  }

  return (
    <Stack direction="column" gap={1}>
      {/* TODO we can add some additional info here with a ToggleTip */}
      <Stack direction="row" alignItems="end" justifyContent="space-between">
        <ContactPointsFilter />

        <Stack direction="row" gap={1}>
          {addContactPointSupported && (
            <LinkButton
              icon="plus"
              aria-label={t('alerting.contact-points-tab.aria-label-add-contact-point', 'add contact point')}
              variant="primary"
              href="/alerting/notifications/receivers/new"
              disabled={!addContactPointAllowed}
            >
              <Trans i18nKey="alerting.contact-points.create">Create contact point</Trans>
            </LinkButton>
          )}
          {exportContactPointsSupported && (
            <Button
              icon="download-alt"
              variant="secondary"
              aria-label={t('alerting.contact-points-tab.aria-label-export-all', 'export all')}
              disabled={!exportContactPointsAllowed}
              onClick={() => showExportDrawer(ALL_CONTACT_POINTS)}
            >
              <Trans i18nKey="alerting.contact-points-tab.export-all">Export all</Trans>
            </Button>
          )}
        </Stack>
      </Stack>
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
        <ContactPointsList contactPoints={contactPoints} search={search} pageSize={DEFAULT_PAGE_SIZE} />
      )}

      {/* Grafana manager Alertmanager does not support global config, Mimir and Cortex do */}
      {/* Extra configs also don't support global config */}
      {!isGrafanaManagedAlertmanager && !isExtraConfig(selectedAlertmanager!) && (
        <GlobalConfigAlert alertManagerName={selectedAlertmanager!} />
      )}
      {ExportDrawer}
    </Stack>
  );
};

export const ContactPointsPageContents = () => {
  const { selectedAlertmanager } = useAlertmanager();

  // Show only contact points (no internal tabs)
  // Templates are accessible via the sidebar navigation
  return (
    <>
      <GrafanaAlertmanagerWarning currentAlertmanager={selectedAlertmanager!} />
      <ContactPointsTab />
    </>
  );
};

interface ContactPointsListProps {
  contactPoints: ContactPointWithMetadata[];
  search?: string | null;
  pageSize?: number;
}

const ContactPointsList = ({ contactPoints, search, pageSize = DEFAULT_PAGE_SIZE }: ContactPointsListProps) => {
  const searchResults = useContactPointsSearch(contactPoints, search);
  const { page, pageItems, numberOfPages, onPageChange } = usePagination(searchResults, 1, pageSize);

  if (pageItems.length === 0) {
    const emptyMessage = t('alerting.contact-points.no-contact-points-found', 'No contact points found');
    return <EmptyState variant="not-found" message={emptyMessage} />;
  }

  return (
    <>
      {pageItems.map((contactPoint, index) => {
        const key = `${contactPoint.name}-${index}`;
        return <ContactPoint key={key} contactPoint={contactPoint} />;
      })}
      <Pagination currentPage={page} numberOfPages={numberOfPages} onNavigate={onPageChange} hideWhenSinglePage />
    </>
  );
};

function ContactPointsPage() {
  const { navId, pageNav } = useNotificationConfigNav();
  return (
    <AlertmanagerPageWrapper navId={navId || 'receivers'} pageNav={pageNav} accessType="notification">
      <ContactPointsPageContents />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(ContactPointsPage);
