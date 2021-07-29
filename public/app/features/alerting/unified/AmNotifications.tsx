import { AlertmanagerGroup, Matcher } from 'app/plugins/datasource/alertmanager/types';
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
import { Alert, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { AmNotificationsGroupBy } from './components/amnotifications/AmNotificationsGroupBy';
import { useGroupedAlerts } from './hooks/useGroupedAlerts';
import { useFlatAmAlerts } from './hooks/useFlatAmAlerts';
import { AmNotificationsFilter } from './components/amnotifications/AmNotificationsFilter';
import { parseMatchers } from './utils/alertmanager';
import { isEqual } from 'lodash';
import { useFilteredAmGroups } from './hooks/useFilteredAmGroups';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

const AlertManagerNotifications = () => {
  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName();
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);

  const alertGroups = useUnifiedAlertingSelector((state) => state.amAlertGroups) || initialAsyncRequestState;
  const loading = alertGroups[alertManagerSourceName || '']?.loading;
  const error = alertGroups[alertManagerSourceName || '']?.error;
  const results: AlertmanagerGroup[] = alertGroups[alertManagerSourceName || '']?.result || [];

  const [groupByKeys, setGroupByKeys] = useState<string[]>([]);
  const [filterMatchers, setFilterMatchers] = useState<Matcher[]>([]);
  const handleGroupingChange = (keys: string[]) => {
    setGroupByKeys(keys);
  };

  const handleFilterChange = (queryString: string) => {
    const matchers = parseMatchers(queryString);
    if (!isEqual(matchers, filterMatchers)) {
      setFilterMatchers(matchers);
    }
  };

  const flattenedAlerts = useFlatAmAlerts(results);
  const groupedAlerts = useGroupedAlerts(flattenedAlerts, groupByKeys);
  const groupToFilter = groupByKeys.length > 0 ? groupedAlerts : results;
  const filteredAlerts = useFilteredAmGroups(groupToFilter, filterMatchers);

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
    <AlertingPageWrapper pageId="notifications">
      <div className={styles.filterSection}>
        <AlertManagerPicker current={alertManagerSourceName} onChange={setAlertManagerSourceName} />
        <AmNotificationsFilter onFilterChange={handleFilterChange} />
        <AmNotificationsGroupBy groups={results} onGroupingChange={handleGroupingChange} />
      </div>
      {loading && <LoadingPlaceholder text="Loading notifications" />}
      {error && !loading && (
        <Alert title={'Error loading notifications'} severity={'error'}>
          {error.message || 'Unknown error'}
        </Alert>
      )}
      {results &&
        filteredAlerts.map((group, index) => {
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

const getStyles = (theme: GrafanaTheme2) => ({
  filterSection: css`
    display: flex;
    flex-direction: row;
  `,
});

export default AlertManagerNotifications;
