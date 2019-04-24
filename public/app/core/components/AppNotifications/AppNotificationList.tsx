import React, { PureComponent } from 'react';
import appEvents from 'app/core/app_events';
import AppNotificationItem from './AppNotificationItem';
import { notifyApp, clearAppNotification } from 'app/core/actions';
import { connectWithStore } from 'app/core/utils/connectWithReduxStore';
import { AppNotification, StoreState } from 'app/types';
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

    appEvents.on('alert-warning', options => notifyApp(createWarningNotification(options[0], options[1])));
    appEvents.on('alert-success', options => notifyApp(createSuccessNotification(options[0], options[1])));
    appEvents.on('alert-error', options => notifyApp(createErrorNotification(options[0], options[1])));
  }

  onClearAppNotification = id => {
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
