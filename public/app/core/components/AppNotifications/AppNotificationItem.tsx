import React, { Component } from 'react';
import { AppNotification } from 'app/types';
import { AlertBox } from '../AlertBox/AlertBox';

interface Props {
  appNotification: AppNotification;
  onClearNotification: (id) => void;
}

export default class AppNotificationItem extends Component<Props> {
  shouldComponentUpdate(nextProps) {
    return this.props.appNotification.id !== nextProps.appNotification.id;
  }

  componentDidMount() {
    const { appNotification, onClearNotification } = this.props;
    setTimeout(() => {
      onClearNotification(appNotification.id);
    }, appNotification.timeout);
  }

  render() {
    const { appNotification, onClearNotification } = this.props;

    return (
      <AlertBox
        severity={appNotification.severity}
        title={appNotification.title}
        text={appNotification.text}
        icon={appNotification.icon}
        onClose={() => onClearNotification(appNotification.id)}
      />
    );
  }
}
