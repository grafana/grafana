import React, { PureComponent } from 'react';
import appEvents from 'app/core/app_events';
import AppNotificationItem from './AppNotificationItem';
import { notifyApp, clearAppNotification } from 'app/core/actions';
import { StoreState } from 'app/types';

import {
  createErrorNotification,
  createSuccessNotification,
  createWarningNotification,
} from '../../copy/appNotification';
import { AppEvents } from '@grafana/data';
import { connect, ConnectedProps } from 'react-redux';
import { VerticalGroup } from '@grafana/ui';

export interface OwnProps {}

const mapStateToProps = (state: StoreState, props: OwnProps) => ({
  appNotifications: state.appNotifications.appNotifications,
});

const mapDispatchToProps = {
  notifyApp,
  clearAppNotification,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = OwnProps & ConnectedProps<typeof connector>;

export class AppNotificationListUnConnected extends PureComponent<Props> {
  componentDidMount() {
    const { notifyApp } = this.props;

    appEvents.on(AppEvents.alertWarning, (payload) => notifyApp(createWarningNotification(...payload)));
    appEvents.on(AppEvents.alertSuccess, (payload) => notifyApp(createSuccessNotification(...payload)));
    appEvents.on(AppEvents.alertError, (payload) => notifyApp(createErrorNotification(...payload)));
  }

  onClearAppNotification = (id: string) => {
    this.props.clearAppNotification(id);
  };

  render() {
    const { appNotifications } = this.props;

    return (
      <div className="page-alert-list">
        <VerticalGroup>
          {appNotifications.map((appNotification, index) => {
            return (
              <AppNotificationItem
                key={`${appNotification.id}-${index}`}
                appNotification={appNotification}
                onClearNotification={(id) => this.onClearAppNotification(id)}
              />
            );
          })}
        </VerticalGroup>
      </div>
    );
  }
}

export const AppNotificationList = connector(AppNotificationListUnConnected);
