import React, { PureComponent } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { Icon, ConfirmButton, Button } from '@grafana/ui';

import alertDef from './state/alertDef';
import { DashboardModel } from '../dashboard/state/DashboardModel';
import { css } from 'emotion';

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
      .get(
        `/api/annotations?dashboardId=${dashboard.id}&panelId=${panelId}&limit=50&type=alert`,
        {},
        `state-history-${dashboard.id}-${panelId}`
      )
      .then(data => {
        const items = data.map((item: any) => {
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

  clearHistory = async () => {
    const { dashboard, panelId, onRefresh } = this.props;

    await getBackendSrv().post('/api/annotations/mass-delete', {
      dashboardId: dashboard.id,
      panelId: panelId,
    });

    this.setState({ stateHistoryItems: [] });
    onRefresh();
  };

  render() {
    const { stateHistoryItems } = this.state;

    return (
      <div>
        {stateHistoryItems.length > 0 && (
          <div className="p-b-1">
            <span className="muted">Last 50 state changes</span>
            <ConfirmButton onConfirm={this.clearHistory} confirmVariant="destructive" confirmText="Clear">
              <Button
                className={css`
                  direction: ltr;
                `}
                variant="destructive"
                icon="trash-alt"
              >
                Clear history
              </Button>
            </ConfirmButton>
          </div>
        )}
        <ol className="alert-rule-list">
          {stateHistoryItems.length > 0 ? (
            stateHistoryItems.map((item, index) => {
              return (
                <li className="alert-rule-item" key={`${item.time}-${index}`}>
                  <div className={`alert-rule-item__icon ${item.stateModel.stateClass}`}>
                    <Icon name={item.stateModel.iconClass} size="xl" />
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
