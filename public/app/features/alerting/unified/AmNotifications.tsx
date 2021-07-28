import { AlertmanagerGroup } from 'app/plugins/datasource/alertmanager/types';
import React, { useEffect, useState } from 'react';

import { useDispatch } from 'react-redux';

import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertManagerPicker } from './components/AlertManagerPicker';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAlertGroupsAction } from './state/actions';
import { initialAsyncRequestState } from './utils/redux';

import { AmNotificationsGroup } from './components/amnotifications/AmNotificationsGroup';
import { NOTIFICATIONS_POLL_INTERVAL_MS } from './utils/constants';
import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { AmNotificationsGroupBy } from './components/amnotifications/AmNotificationsGroupBy';
import { useGroupedAlerts } from './hooks/useGroupedAlerts';
import { useFlatAmAlerts } from './hooks/useFlatAmAlerts';

const AlertManagerNotifications = () => {
  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName();
  const dispatch = useDispatch();

  const alertGroups = useUnifiedAlertingSelector((state) => state.amAlertGroups) || initialAsyncRequestState;
  const loading = alertGroups[alertManagerSourceName || '']?.loading;
  const error = alertGroups[alertManagerSourceName || '']?.error;
  const results: AlertmanagerGroup[] = alertGroups[alertManagerSourceName || '']?.result || [];

  const [groupByKeys, setGroupByKeys] = useState<string[]>([]);
  const handleGroupingChange = (keys: string[]) => {
    setGroupByKeys(keys);
  };

  const flattenedAlerts = useFlatAmAlerts(results);

  const groupedAlerts = useGroupedAlerts(flattenedAlerts, groupByKeys);

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

  const groupsToDisplay = groupByKeys.length > 0 ? groupedAlerts : results;

  return (
    <AlertingPageWrapper pageId="notifications">
      <AlertManagerPicker current={alertManagerSourceName} onChange={setAlertManagerSourceName} />
      <AmNotificationsGroupBy groups={results} handleGroupingChange={handleGroupingChange} />
      {loading && <LoadingPlaceholder text="Loading notifications" />}
      {error && !loading && (
        <Alert title={'Error loading notifications'} severity={'error'}>
          {error.message || 'Unknown error'}
        </Alert>
      )}
      {results &&
        groupsToDisplay.map((group, index) => {
          return (
            <AmNotificationsGroup
              alertManagerSourceName={alertManagerSourceName || ''}
              key={`${JSON.stringify(group.labels)}-group-${index}`}
              group={group}
            />
          );
        })}
    </AlertingPageWrapper>
  );
};

export default AlertManagerNotifications;
