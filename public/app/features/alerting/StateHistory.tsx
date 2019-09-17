import React, { PureComponent } from 'react';
import alertDef from './state/alertDef';
import { getBackendSrv } from '@grafana/runtime';
import { DashboardModel } from '../dashboard/state/DashboardModel';
import appEvents from '../../core/app_events';

interface Props {
  dashboard: DashboardModel;
  panelId: number;
  onRefresh: () => void;
}

interface State {
  stateHistoryItems: any[];
}

class StateHistory extends PureComponent<Props, State> {
  state: State = {
    stateHistoryItems: [],
  };

  componentDidMount(): void {
    const { dashboard, panelId } = this.props;

    getBackendSrv()
      .get(`/api/annotations?dashboardId=${dashboard.id}&panelId=${panelId}&limit=50&type=alert`)
      .then((res: any[]) => {
        const items = res.map((item: any) => {
          return {
            stateModel: alertDef.getStateDisplayModel(item.newState),
            time: dashboard.formatDate(item.time, 'MMM D, YYYY HH:mm:ss'),
            info: alertDef.getAlertAnnotationInfo(item),
          };
        });

        this.setState({
          stateHistoryItems: items,
        });
      });
  }

  clearHistory = () => {
    const { dashboard, onRefresh, panelId } = this.props;

    appEvents.emit('confirm-modal', {
      title: 'Delete Alert History',
      text: 'Are you sure you want to remove all history & annotations for this alert?',
      icon: 'fa-trash',
      yesText: 'Yes',
      onConfirm: () => {
        getBackendSrv()
          .post('/api/annotations/mass-delete', {
            dashboardId: dashboard.id,
            panelId: panelId,
          })
          .then(() => {
            onRefresh();
          });

        this.setState({
          stateHistoryItems: [],
        });
      },
    });
  };

  render() {
    const { stateHistoryItems } = this.state;

    return (
      <div>
        {stateHistoryItems.length > 0 && (
          <div className="p-b-1">
            <span className="muted">Last 50 state changes</span>
            <button className="btn btn-small btn-danger pull-right" onClick={this.clearHistory}>
              <i className="fa fa-trash" /> {` Clear history`}
            </button>
          </div>
        )}
        <ol className="alert-rule-list">
          {stateHistoryItems.length > 0 ? (
            stateHistoryItems.map((item, index) => {
              return (
                <li className="alert-rule-item" key={`${item.time}-${index}`}>
                  <div className={`alert-rule-item__icon ${item.stateModel.stateClass}`}>
                    <i className={item.stateModel.iconClass} />
                  </div>
                  <div className="alert-rule-item__body">
                    <div className="alert-rule-item__header">
                      <p className="alert-rule-item__name">{item.alertName}</p>
                      <div className="alert-rule-item__text">
                        <span className={`${item.stateModel.stateClass}`}>{item.stateModel.text}</span>
                      </div>
                    </div>
                    {item.info}
                  </div>
                  <div className="alert-rule-item__time">{item.time}</div>
                </li>
              );
            })
          ) : (
            <i>No state changes recorded</i>
          )}
        </ol>
      </div>
    );
  }
}

export default StateHistory;
