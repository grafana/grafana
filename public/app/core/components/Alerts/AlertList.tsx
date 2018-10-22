import React, { PureComponent } from 'react';
import { connect } from 'react-redux';

export interface Props {
  alerts: any[];
}

export class AlertList extends PureComponent<Props> {
  onClearAlert = alert => {
    console.log('clear alert', alert);
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
              <button type="button" className="alert-close" onClick={() => this.onClearAlert(alert)}>
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

export default connect(mapStateToProps)(AlertList);
