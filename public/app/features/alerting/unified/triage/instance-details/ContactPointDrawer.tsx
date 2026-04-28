import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { Alert, EmptyState, LoadingPlaceholder, Stack } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { ContactPointsList } from 'app/features/alerting/unified/components/contact-points/ContactPoints';
import { useContactPointsWithStatus } from 'app/features/alerting/unified/components/contact-points/useContactPoints';
import { useContactPointsSearch } from 'app/features/alerting/unified/components/contact-points/useContactPointsSearch';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { shouldUseK8sApi } from 'app/features/alerting/unified/utils/k8s/utils';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';
import { AccessControlAction } from 'app/types/accessControl';

const DEFAULT_PAGE_SIZE = 10;

export interface ContactPointDrawerProps {
  listSearchQuery: string;
  /** Optional K8s `metadata.name` hint; used to prefer an exact row from the fetched list when available. */
  receiverResourceId?: string;
}

export function ContactPointDrawer({ listSearchQuery, receiverResourceId }: ContactPointDrawerProps) {
  const fetchPolicies = useMemo(() => !shouldUseK8sApi(GRAFANA_RULES_SOURCE_NAME), []);
  const fetchStatuses = contextSrv.hasPermission(AccessControlAction.AlertingNotificationsRead);

  const { isLoading, error, contactPoints } = useContactPointsWithStatus({
    alertmanager: GRAFANA_RULES_SOURCE_NAME,
    fetchPolicies,
    fetchStatuses,
  });

  const trimmedSearch = listSearchQuery.trim();
  const fuzzyMatches = useContactPointsSearch(contactPoints, trimmedSearch ? trimmedSearch : null);

  /**
   * When set, `ContactPointsList` receives a single contact point so it can render `ContactPointInstanceDrawerDetails`
   * instead of paginated cards.
   */
  const resolvedUniqueContactPoint = useMemo(() => {
    if (receiverResourceId) {
      return contactPoints.find((cp) => cp.id === receiverResourceId);
    }
    if (!trimmedSearch) {
      return undefined;
    }
    const exactByName = contactPoints.find((cp) => cp.name === trimmedSearch);
    if (exactByName) {
      return exactByName;
    }
    if (fuzzyMatches.length === 1) {
      return fuzzyMatches[0];
    }
    return undefined;
  }, [contactPoints, receiverResourceId, trimmedSearch, fuzzyMatches]);

  const listContactPoints = resolvedUniqueContactPoint ? [resolvedUniqueContactPoint] : contactPoints;
  const searchForList = resolvedUniqueContactPoint ? undefined : trimmedSearch || undefined;

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
        instanceDrawerEmbed
        fallbackWhenSearchUnmatched={!resolvedUniqueContactPoint}
      />
    </Stack>
  );
}
