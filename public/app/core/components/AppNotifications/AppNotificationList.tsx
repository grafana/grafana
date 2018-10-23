import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import appEvents from 'app/core/app_events';
import { addAppNotification, clearAppNotification } from './state/actions';

export interface Props {
  alerts: any[];
  addAppNotification: typeof addAppNotification;
  clearAppNotification: typeof clearAppNotification;
}

enum AppNotificationSeverity {
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
  Info = 'info',
}

export class AppNotificationList extends PureComponent<Props> {
  componentDidMount() {
    appEvents.on('alert-warning', options => this.addAppNotification(options[0], options[1], 'warning', 5000));
    appEvents.on('alert-success', options => this.addAppNotification(options[0], options[1], 'success', 3000));
    appEvents.on('alert-error', options => this.addAppNotification(options[0], options[1], 'error', 7000));
  }

  addAppNotification(title, text, severity, timeout) {
    const newAlert = {
      title: title || '',
      text: text || '',
      severity: severity || AppNotificationSeverity.Info,
      icon: this.getIconForSeverity(severity),
      remove: this.clearAutomatically(this, timeout),
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

  clearAutomatically = (alert, timeout) => {
    setTimeout(() => {
      this.props.clearAppNotification(alert);
    }, timeout);
  };

  onClearAppNotification = alert => {
    this.props.clearAppNotification(alert);
  };

  render() {
    const { alerts } = this.props;

    return (
      <div>
        {alerts.map((alert, index) => {
          return (
            <div key={index} className={`alert-${alert.severity} alert`}>
              <div className="alert-icon">
                <i className={alert.icon} />
              </div>
              <div className="alert-body">
                <div className="alert-title">{alert.title}</div>
                <div className="alert-text">{alert.text}</div>
              </div>
              <button type="button" className="alert-close" onClick={() => this.onClearAppNotification(alert)}>
                <i className="fa fa fa-remove" />
              </button>
            </div>
          );
        })}
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    alerts: state.alerts.alerts,
  };
}

const mapDispatchToProps = {
  addAppNotification,
  clearAppNotification,
};

export default connect(mapStateToProps, mapDispatchToProps)(AppNotificationList);
