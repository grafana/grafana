import { Fragment } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Alert, Box, LoadingPlaceholder, Text } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { AlertState, AlertmanagerChoice } from '../../../plugins/datasource/alertmanager/types';

import { type AlertGroupsFilter, alertmanagerApi } from './api/alertmanagerApi';
import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import { InhibitionRulesAlert } from './components/InhibitionRulesAlert';
import { AlertGroup } from './components/alert-groups/AlertGroup';
import { AlertGroupFilter } from './components/alert-groups/AlertGroupFilter';
import { useGroupedAlerts } from './hooks/useGroupedAlerts';
import { useAlertGroupsNav } from './navigation/useAlertActivityNav';
import { useAlertmanager } from './state/AlertmanagerContext';
import { NOTIFICATIONS_POLL_INTERVAL_MS } from './utils/constants';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { parsePromQLStyleMatcherLooseSafe } from './utils/matchers';
import { getFiltersFromUrlParams, stringifyErrorLike } from './utils/misc';
import { withPageErrorBoundary } from './withPageErrorBoundary';

/** Maps the frontend `alertState` URL param to the backend active/silenced/inhibited flags. */
function alertStateToFilterFlags(
  alertState: string | undefined
): Pick<AlertGroupsFilter, 'active' | 'silenced' | 'inhibited'> {
  switch (alertState) {
    case AlertState.Active:
      return { active: true, silenced: false, inhibited: false };
    case AlertState.Suppressed:
      // "suppressed" in the UI covers both silenced and inhibited alerts
      return { active: false, silenced: true, inhibited: true };
    case AlertState.Unprocessed:
      // Unprocessed means neither active, silenced nor inhibited
      return { active: false, silenced: false, inhibited: false };
    default:
      // No state filter — let the backend return all alerts (its default)
      return {};
  }
}

const AlertGroups = () => {
  const { selectedAlertmanager } = useAlertmanager();
  const [queryParams] = useQueryParams();
  const { groupBy = [], queryString, alertState, receivers } = getFiltersFromUrlParams(queryParams);

  const { currentData: amConfigStatus } = alertmanagerApi.endpoints.getGrafanaAlertingConfigurationStatus.useQuery();

  const matchers = queryString ? parsePromQLStyleMatcherLooseSafe(queryString) : [];

  const filter: AlertGroupsFilter = {
    matchers: matchers.length > 0 ? matchers : undefined,
    // The backend `receiver` param is a regex; we send the first selected receiver as a literal match.
    // Multiple receivers are still handled by useGroupedAlerts client-side after the response.
    receiver: receivers?.length === 1 ? receivers[0] : undefined,
    ...alertStateToFilterFlags(alertState),
  };

  const {
    currentData: results = [],
    isLoading,
    isError,
    error,
  } = alertmanagerApi.endpoints.getAlertmanagerAlertGroups.useQuery(
    { amSourceName: selectedAlertmanager ?? '', filter },
    {
      skip: !selectedAlertmanager,
      pollingInterval: NOTIFICATIONS_POLL_INTERVAL_MS,
    }
  );

  // Client-side re-grouping by custom groupBy label keys (cannot be done server-side).
  // When multiple receivers are selected, also filter groups to matching receivers here.
  const groupedAlerts = useGroupedAlerts(results, groupBy);
  const filteredAlertGroups =
    receivers && receivers.length > 1
      ? groupedAlerts.filter((g) => receivers.includes(g.receiver.name))
      : groupedAlerts;

  const grafanaAmDeliveryDisabled =
    selectedAlertmanager === GRAFANA_RULES_SOURCE_NAME &&
    amConfigStatus?.alertmanagersChoice === AlertmanagerChoice.External;

  return (
    <>
      <AlertGroupFilter groups={results} />
      {isLoading && (
        <LoadingPlaceholder text={t('alerting.alert-groups.text-loading-notifications', 'Loading notifications')} />
      )}
      {isError && !isLoading && (
        <Alert
          title={t('alerting.alert-groups.title-error-loading-notifications', 'Error loading notifications')}
          severity={'error'}
        >
          {stringifyErrorLike(error)}
        </Alert>
      )}

      {grafanaAmDeliveryDisabled && (
        <Alert
          title={t(
            'alerting.alert-groups.title-grafana-alerts-delivered-alertmanager',
            'Grafana alerts are not delivered to Grafana Alertmanager'
          )}
        >
          <Trans i18nKey="alerting.alert-groups.body-grafana-alerted-delivered">
            Grafana is configured to send alerts to external alertmanagers only. No alerts are expected to be available
            here for the selected Alertmanager.
          </Trans>
        </Alert>
      )}

      {selectedAlertmanager && <InhibitionRulesAlert alertmanagerSourceName={selectedAlertmanager} />}

      {results &&
        filteredAlertGroups.map((group, index) => {
          return (
            <Fragment key={`${JSON.stringify(group.labels)}-group-${index}`}>
              {((index === 1 && Object.keys(filteredAlertGroups[0].labels).length === 0) ||
                (index === 0 && Object.keys(group.labels).length > 0)) && (
                <Box paddingY={2}>
                  <Text element="h2" variant="body">
                    <Trans
                      i18nKey="alerting.alert-groups.grouped-by"
                      values={{ labels: Object.keys(group.labels).join(', ') }}
                    >
                      Grouped by: {'{{labels}}'}
                    </Trans>
                  </Text>
                </Box>
              )}
              <AlertGroup alertManagerSourceName={selectedAlertmanager || ''} group={group} />
            </Fragment>
          );
        })}
      {results && !filteredAlertGroups.length && (
        <p>
          <Trans i18nKey="alerting.alert-groups.no-results">No results.</Trans>
        </p>
      )}
    </>
  );
};

function AlertGroupsPage() {
  const { navId, pageNav } = useAlertGroupsNav();

  return (
    <AlertmanagerPageWrapper navId={navId} pageNav={pageNav} accessType="instance">
      <AlertGroups />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(AlertGroupsPage);
