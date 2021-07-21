import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { PanelProps } from '@grafana/data';
import { CustomScrollbar } from '@grafana/ui';

import { AlertmanagerGroup } from 'app/plugins/datasource/alertmanager/types';
import { fetchAlertGroupsAction } from 'app/features/alerting/unified/state/actions';
import { initialAsyncRequestState } from 'app/features/alerting/unified/utils/redux';
import { NOTIFICATIONS_POLL_INTERVAL_MS } from 'app/features/alerting/unified/utils/constants';
import { useUnifiedAlertingSelector } from 'app/features/alerting/unified/hooks/useUnifiedAlertingSelector';

import { AmNotificationsGroup } from './AmNotificationsGroup';
import { AMNotificationsOptions } from './types';

export const AMNotifications = (props: PanelProps<AMNotificationsOptions>) => {
  const dispatch = useDispatch();

  const alertManagerSourceName = props.options.alertmanager;

  const alertGroups = useUnifiedAlertingSelector((state) => state.amAlertGroups) || initialAsyncRequestState;
  const loading = alertGroups[alertManagerSourceName || '']?.loading;
  const error = alertGroups[alertManagerSourceName || '']?.error;
  const results: AlertmanagerGroup[] = alertGroups[alertManagerSourceName || '']?.result || [];

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
    <CustomScrollbar autoHeightMax="100%" autoHeightMin="100%">
      <div>
        {!error &&
          !loading &&
          results &&
          results.map((group) => {
            return <AmNotificationsGroup key={JSON.stringify(group.labels)} group={group} />;
          })}
      </div>
    </CustomScrollbar>
  );
};
