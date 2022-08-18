import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { AppEvents } from '@grafana/data';
import { VerticalGroup } from '@grafana/ui';
import { notifyApp, hideAppNotification } from 'app/core/actions';
import appEvents from 'app/core/app_events';
import { selectVisible } from 'app/core/reducers/appNotification';
import { StoreState } from 'app/types';

import {
  createErrorNotification,
  createSuccessNotification,
  createWarningNotification,
} from '../../copy/appNotification';

import AppNotificationItem from './AppNotificationItem';

export interface OwnProps {}

const mapStateToProps = (state: StoreState, props: OwnProps) => ({
  appNotifications: selectVisible(state.appNotifications),
});

const mapDispatchToProps = {
  notifyApp,
  hideAppNotification,
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
    this.props.hideAppNotification(id);
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
