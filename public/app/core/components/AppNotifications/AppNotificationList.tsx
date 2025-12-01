import { css } from '@emotion/css';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { AlertErrorPayload, AlertPayload, AppEvents, GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Stack } from '@grafana/ui';
import { notifyApp, hideAppNotification } from 'app/core/actions';
import { appEvents } from 'app/core/app_events';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { selectVisible } from 'app/core/reducers/appNotification';
import { useSelector, useDispatch } from 'app/types/store';

import {
  createErrorNotification,
  createInfoNotification,
  createSuccessNotification,
  createWarningNotification,
} from '../../copy/appNotification';

import AppNotificationItem from './AppNotificationItem';

export function AppNotificationList() {
  const appNotifications = useSelector((state) => selectVisible(state.appNotifications));
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);
  const { chrome } = useGrafana();
  const location = useLocation();

  // Store location ref to avoid re-registering listeners on route changes
  const locationRef = useRef(location);
  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    // Suppress error notifications in kiosk mode on dashboards.
    // Kiosk mode is typically used for TV displays which are non-interactive.
    // Backend errors like "Failed to fetch" cannot be dismissed and would remain visible,
    // degrading the viewing experience. Other notification types (success, warning, info)
    // are still shown as they indicate successful operations or important information.
    const handleErrorAlert = (payload?: AlertErrorPayload) => {
      const isKioskDashboard = chrome.state.getValue().kioskMode && locationRef.current.pathname.startsWith('/d/');
      if (isKioskDashboard || !payload) {
        return;
      }
      dispatch(notifyApp(createErrorNotification(...payload)));
    };

    const handleWarningAlert = (payload?: AlertPayload) => {
      if (!payload) {
        return;
      }
      dispatch(notifyApp(createWarningNotification(...payload)));
    };

    const handleSuccessAlert = (payload?: AlertPayload) => {
      if (!payload) {
        return;
      }
      dispatch(notifyApp(createSuccessNotification(...payload)));
    };

    const handleInfoAlert = (payload?: AlertPayload) => {
      if (!payload) {
        return;
      }
      dispatch(notifyApp(createInfoNotification(...payload)));
    };

    appEvents.on(AppEvents.alertWarning, handleWarningAlert);
    appEvents.on(AppEvents.alertSuccess, handleSuccessAlert);
    appEvents.on(AppEvents.alertError, handleErrorAlert);
    appEvents.on(AppEvents.alertInfo, handleInfoAlert);

    return () => {
      // Unsubscribe from events on unmount to avoid memory leaks
      appEvents.off(AppEvents.alertWarning, handleWarningAlert);
      appEvents.off(AppEvents.alertSuccess, handleSuccessAlert);
      appEvents.off(AppEvents.alertError, handleErrorAlert);
      appEvents.off(AppEvents.alertInfo, handleInfoAlert);
    };
  }, [dispatch, chrome]);

  const onClearAppNotification = (id: string) => {
    dispatch(hideAppNotification(id));
  };

  return (
    <div className={styles.wrapper}>
      <Stack direction="column">
        {appNotifications.map((appNotification, index) => {
          return (
            <AppNotificationItem
              key={`${appNotification.id}-${index}`}
              appNotification={appNotification}
              onClearNotification={onClearAppNotification}
            />
          );
        })}
      </Stack>
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
      right: 6,
      top: 88,
    }),
  };
}
