import { AlertmanagerGroup } from 'app/plugins/datasource/alertmanager/types';
import React, { useEffect } from 'react';

import { useDispatch } from 'react-redux';

import { AlertingPageWrapper } from './components/AlertingPageWrapper';

import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAlertGroupsAction } from './state/actions';
import { initialAsyncRequestState } from './utils/redux';

import { AlertGroup } from './components/alert-groups/AlertGroup';
import { NOTIFICATIONS_POLL_INTERVAL_MS } from './utils/constants';
import { Alert, LoadingPlaceholder } from '@grafana/ui';

import { useGroupedAlerts } from './hooks/useGroupedAlerts';
import { useFlatAmAlerts } from './hooks/useFlatAmAlerts';

import { useFilteredAmGroups } from './hooks/useFilteredAmGroups';

import { AlertGroupFilter } from './components/alert-groups/AlertGroupFilter';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { getFiltersFromUrlParams } from './utils/misc';

const AlertGroups = () => {
  const [alertManagerSourceName] = useAlertManagerSourceName();
  const dispatch = useDispatch();
  const [queryParams] = useQueryParams();
  const { groupBy = [] } = getFiltersFromUrlParams(queryParams);

  const alertGroups = useUnifiedAlertingSelector((state) => state.amAlertGroups) || initialAsyncRequestState;
  const loading = alertGroups[alertManagerSourceName || '']?.loading;
  const error = alertGroups[alertManagerSourceName || '']?.error;
  const results: AlertmanagerGroup[] = alertGroups[alertManagerSourceName || '']?.result || [];

  const flattenedAlerts = useFlatAmAlerts(results);
  const groupedAlerts = useGroupedAlerts(flattenedAlerts, groupBy);
  const groupToFilter = groupBy.length > 0 ? groupedAlerts : results;
  const filteredAlerts = useFilteredAmGroups(groupToFilter);

  useEffect(() => {
    function fetchNotifications() {
      if (alertManagerSourceName) {
        dispatch(fetchAlertGroupsAction(alertManagerSourceName));
      }
    }
    fetchNotifications();
    const interval = setInterval(() => fetchNotifications, NOTIFICATIONS_POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [dispatch, alertManagerSourceName]);

  return (
    <AlertingPageWrapper pageId="groups">
      <AlertGroupFilter groups={results} />
      {loading && <LoadingPlaceholder text="Loading notifications" />}
      {error && !loading && (
        <Alert title={'Error loading notifications'} severity={'error'}>
          {error.message || 'Unknown error'}
        </Alert>
      )}
      {results &&
        filteredAlerts.map((group, index) => {
          return (
            <AlertGroup
              alertManagerSourceName={alertManagerSourceName || ''}
              key={`${JSON.stringify(group.labels)}-group-${index}`}
              group={group}
            />
          );
        })}
    </AlertingPageWrapper>
  );
};

export default AlertGroups;
