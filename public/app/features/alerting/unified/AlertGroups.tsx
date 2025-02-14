import { Fragment, useEffect } from 'react';

import { Alert, Box, LoadingPlaceholder, Text } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { useDispatch } from 'app/types';

import { AlertmanagerChoice } from '../../../plugins/datasource/alertmanager/types';

import { alertmanagerApi } from './api/alertmanagerApi';
import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import { AlertGroup } from './components/alert-groups/AlertGroup';
import { AlertGroupFilter } from './components/alert-groups/AlertGroupFilter';
import { useFilteredAmGroups } from './hooks/useFilteredAmGroups';
import { useGroupedAlerts } from './hooks/useGroupedAlerts';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { useAlertmanager } from './state/AlertmanagerContext';
import { fetchAlertGroupsAction } from './state/actions';
import { NOTIFICATIONS_POLL_INTERVAL_MS } from './utils/constants';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { getFiltersFromUrlParams } from './utils/misc';
import { initialAsyncRequestState } from './utils/redux';
import { withPageErrorBoundary } from './withPageErrorBoundary';

const AlertGroups = () => {
  const { selectedAlertmanager } = useAlertmanager();
  const dispatch = useDispatch();
  const [queryParams] = useQueryParams();
  const { groupBy = [] } = getFiltersFromUrlParams(queryParams);

  const { currentData: amConfigStatus } = alertmanagerApi.endpoints.getGrafanaAlertingConfigurationStatus.useQuery();

  const alertGroups = useUnifiedAlertingSelector((state) => state.amAlertGroups);
  const { loading, error, result: results = [] } = alertGroups[selectedAlertmanager || ''] ?? initialAsyncRequestState;

  const groupedAlerts = useGroupedAlerts(results, groupBy);
  const filteredAlertGroups = useFilteredAmGroups(groupedAlerts);

  const grafanaAmDeliveryDisabled =
    selectedAlertmanager === GRAFANA_RULES_SOURCE_NAME &&
    amConfigStatus?.alertmanagersChoice === AlertmanagerChoice.External;

  useEffect(() => {
    function fetchNotifications() {
      if (selectedAlertmanager) {
        dispatch(fetchAlertGroupsAction(selectedAlertmanager));
      }
    }
    fetchNotifications();
    const interval = setInterval(fetchNotifications, NOTIFICATIONS_POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [dispatch, selectedAlertmanager]);

  return (
    <>
      <AlertGroupFilter groups={results} />
      {loading && <LoadingPlaceholder text="Loading notifications" />}
      {error && !loading && (
        <Alert title={'Error loading notifications'} severity={'error'}>
          {error.message || 'Unknown error'}
        </Alert>
      )}

      {grafanaAmDeliveryDisabled && (
        <Alert title="Grafana alerts are not delivered to Grafana Alertmanager">
          Grafana is configured to send alerts to external alertmanagers only. No alerts are expected to be available
          here for the selected Alertmanager.
        </Alert>
      )}

      {results &&
        filteredAlertGroups.map((group, index) => {
          return (
            <Fragment key={`${JSON.stringify(group.labels)}-group-${index}`}>
              {((index === 1 && Object.keys(filteredAlertGroups[0].labels).length === 0) ||
                (index === 0 && Object.keys(group.labels).length > 0)) && (
                <Box paddingY={2}>
                  <Text element="h2" variant="body">
                    Grouped by: {Object.keys(group.labels).join(', ')}
                  </Text>
                </Box>
              )}
              <AlertGroup alertManagerSourceName={selectedAlertmanager || ''} group={group} />
            </Fragment>
          );
        })}
      {results && !filteredAlertGroups.length && <p>No results.</p>}
    </>
  );
};

function AlertGroupsPage() {
  return (
    <AlertmanagerPageWrapper navId="groups" accessType="instance">
      <AlertGroups />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(AlertGroupsPage);
