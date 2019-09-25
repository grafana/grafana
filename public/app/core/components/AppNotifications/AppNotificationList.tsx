import React, { PureComponent } from 'react';
import appEvents from 'app/core/app_events';
import AppNotificationItem from './AppNotificationItem';
import { notifyApp, clearAppNotification } from 'app/core/actions';
import { connectWithStore } from 'app/core/utils/connectWithReduxStore';
import { AppNotification, StoreState } from 'app/types';
import { AlertPayload, alertWarning, alertSuccess, alertError } from '@grafana/data';
import {
  createErrorNotification,
  createSuccessNotification,
  createWarningNotification,
} from '../../copy/appNotification';

export interface Props {
  appNotifications: AppNotification[];
  notifyApp: typeof notifyApp;
  clearAppNotification: typeof clearAppNotification;
}

export class AppNotificationList extends PureComponent<Props> {
  componentDidMount() {
    const { notifyApp } = this.props;

    appEvents.on(alertWarning, (payload: AlertPayload) => notifyApp(createWarningNotification(payload[0], payload[1])));
    appEvents.on(alertSuccess, (payload: AlertPayload) => notifyApp(createSuccessNotification(payload[0], payload[1])));
    appEvents.on(alertError, (payload: AlertPayload) => notifyApp(createErrorNotification(payload[0], payload[1])));
  }

  onClearAppNotification = (id: number) => {
    this.props.clearAppNotification(id);
  };

  render() {
    const { appNotifications } = this.props;

    return (
      <div>
        {appNotifications.map((appNotification, index) => {
          return (
            <AppNotificationItem
              key={`${appNotification.id}-${index}`}
              appNotification={appNotification}
              onClearNotification={id => this.onClearAppNotification(id)}
            />
          );
        })}
      </div>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  appNotifications: state.appNotifications.appNotifications,
});

const mapDispatchToProps = {
  notifyApp,
  clearAppNotification,
};

export default connectWithStore(AppNotificationList, mapStateToProps, mapDispatchToProps);
