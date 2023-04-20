import { css } from '@emotion/css';
import React, { useEffect } from 'react';

import { AppEvents, GrafanaTheme2 } from '@grafana/data';
import { useStyles2, VerticalGroup } from '@grafana/ui';
import { notifyApp, hideAppNotification } from 'app/core/actions';
import appEvents from 'app/core/app_events';
import { selectVisible } from 'app/core/reducers/appNotification';
import { useSelector, useDispatch } from 'app/types';

import {
  createErrorNotification,
  createSuccessNotification,
  createWarningNotification,
} from '../../copy/appNotification';

import AppNotificationItem from './AppNotificationItem';

export function AppNotificationList() {
  const appNotifications = useSelector((state) => selectVisible(state.appNotifications));
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);

  useEffect(() => {
    appEvents.on(AppEvents.alertWarning, (payload) => notifyApp(createWarningNotification(...payload)));
    appEvents.on(AppEvents.alertSuccess, (payload) => notifyApp(createSuccessNotification(...payload)));
    appEvents.on(AppEvents.alertError, (payload) => notifyApp(createErrorNotification(...payload)));
  }, []);

  const onClearAppNotification = (id: string) => {
    dispatch(hideAppNotification(id));
  };

  return (
    <div className={styles.wrapper}>
      <VerticalGroup>
        {appNotifications.map((appNotification, index) => {
          return (
            <AppNotificationItem
              key={`${appNotification.id}-${index}`}
              appNotification={appNotification}
              onClearNotification={onClearAppNotification}
            />
          );
        })}
      </VerticalGroup>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      label: 'app-notifications-list',
      zIndex: theme.zIndex.portal,
      minWidth: 400,
      maxWidth: 600,
      position: 'fixed',
      right: 10,
      top: 60,
    }),
  };
}
