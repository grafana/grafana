import React, { PureComponent } from 'react';
import appEvents from 'app/core/app_events';
import { addAppNotification, clearAppNotification } from '../../actions/appNotification';
import { connectWithStore } from 'app/core/utils/connectWithReduxStore';
import { AppNotification, AppNotificationSeverity, StoreState } from 'app/types';

export interface Props {
  appNotifications: AppNotification[];
  addAppNotification: typeof addAppNotification;
  clearAppNotification: typeof clearAppNotification;
}

export class AppNotificationList extends PureComponent<Props> {
  componentDidMount() {
    appEvents.on('alert-warning', options => this.addAppNotification(options[0], options[1], 'warning', 5000));
    appEvents.on('alert-success', options => this.addAppNotification(options[0], options[1], 'success', 3000));
    appEvents.on('alert-error', options => this.addAppNotification(options[0], options[1], 'error', 7000));
  }

  addAppNotification(title, text, severity, timeout) {
    const id = Date.now();
    const newAlert = {
      id: id,
      title: title || '',
      text: text || '',
      severity: severity || AppNotificationSeverity.Info,
      icon: this.getIconForSeverity(severity),
      remove: this.clearAutomatically(id, timeout),
    };

    this.props.addAppNotification(newAlert);
  }

  getIconForSeverity(severity) {
    switch (severity) {
      case AppNotificationSeverity.Success:
        return 'fa fa-check';
      case AppNotificationSeverity.Error:
        return 'fa fa-exclamation-triangle';
      default:
        return 'fa fa-exclamation';
    }
  }

  clearAutomatically = (id, timeout) => {
    setTimeout(() => {
      this.props.clearAppNotification(id);
    }, timeout);
  };

  onClearAppNotification = id => {
    this.props.clearAppNotification(id);
  };

  render() {
    const { appNotifications } = this.props;

    return (
      <div>
        {appNotifications.map((appNotification, index) => {
          return (
            <div key={index} className={`alert-${appNotification.severity} alert`}>
              <div className="alert-icon">
                <i className={appNotification.icon} />
              </div>
              <div className="alert-body">
                <div className="alert-title">{appNotification.title}</div>
                <div className="alert-text">{appNotification.text}</div>
              </div>
              <button
                type="button"
                className="alert-close"
                onClick={() => this.onClearAppNotification(appNotification.id)}
              >
                <i className="fa fa fa-remove" />
              </button>
            </div>
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
  addAppNotification,
  clearAppNotification,
};

export default connectWithStore(AppNotificationList, mapStateToProps, mapDispatchToProps);
