import React, { Component } from 'react';
import { AppNotification } from 'app/types';

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
      <div className={`alert-${appNotification.severity} alert`}>
        <div className="alert-icon">
          <i className={appNotification.icon} />
        </div>
        <div className="alert-body">
          <div className="alert-title">{appNotification.title}</div>
          <div className="alert-text">{appNotification.text}</div>
        </div>
        <button type="button" className="alert-close" onClick={() => onClearNotification(appNotification.id)}>
          <i className="fa fa fa-remove" />
        </button>
      </div>
    );
  }
}
