import React from 'react';
import classNames from 'classnames';
import { inject, observer } from 'mobx-react';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import { IAlertRule } from 'app/stores/AlertListStore/AlertListStore';
import appEvents from 'app/core/app_events';
import IContainerProps from 'app/containers/IContainerProps';

@inject('view', 'nav', 'alertList')
@observer
export class AlertRuleList extends React.Component<IContainerProps, any> {
  stateFilters = [
    { text: 'All', value: 'all' },
    { text: 'OK', value: 'ok' },
    { text: 'Not OK', value: 'not_ok' },
    { text: 'Alerting', value: 'alerting' },
    { text: 'No Data', value: 'no_data' },
    { text: 'Paused', value: 'paused' },
  ];

  constructor(props) {
    super(props);

    this.props.nav.load('alerting', 'alert-list');
    this.fetchRules();
  }

  onStateFilterChanged = evt => {
    this.props.view.updateQuery({ state: evt.target.value });
    this.fetchRules();
  };

  fetchRules() {
    this.props.alertList.loadRules({
      state: this.props.view.query.get('state') || 'all',
    });
  }

  onOpenHowTo = () => {
    appEvents.emit('show-modal', {
      src: 'public/app/features/alerting/partials/alert_howto.html',
      modalClass: 'confirm-modal',
      model: {},
    });
  };

  render() {
    const { nav, alertList } = this.props;

    return (
      <div>
        <PageHeader model={nav as any} />
        <div className="page-container page-body">
          <div className="page-action-bar">
            <div className="gf-form">
              <label className="gf-form-label">Filter by state</label>

              <div className="gf-form-select-wrapper width-13">
                <select className="gf-form-input" onChange={this.onStateFilterChanged} value={alertList.stateFilter}>
                  {this.stateFilters.map(AlertStateFilterOption)}
                </select>
              </div>
            </div>

            <div className="page-action-bar__spacer" />

            <a className="btn btn-secondary" onClick={this.onOpenHowTo}>
              <i className="fa fa-info-circle" /> How to add an alert
            </a>
          </div>

          <section className="card-section card-list-layout-list">
            <ol className="card-list">{alertList.rules.map(rule => <AlertRuleItem rule={rule} key={rule.id} />)}</ol>
          </section>
        </div>
      </div>
    );
  }
}

function AlertStateFilterOption({ text, value }) {
  return (
    <option key={value} value={value}>
      {text}
    </option>
  );
}

export interface AlertRuleItemProps {
  rule: IAlertRule;
}

@observer
export class AlertRuleItem extends React.Component<AlertRuleItemProps, any> {
  toggleState = () => {
    this.props.rule.togglePaused();
  };

  render() {
    const { rule } = this.props;

    let stateClass = classNames({
      fa: true,
      'fa-play': rule.isPaused,
      'fa-pause': !rule.isPaused,
    });

    let ruleUrl = `dashboard/${rule.dashboardUri}?panelId=${rule.panelId}&fullscreen&edit&tab=alert`;

    return (
      <li className="card-item-wrapper">
        <div className="card-item card-item--alert">
          <div className="card-item-header">
            <div className="card-item-type">
              <a
                className="card-item-cog"
                title="Pausing an alert rule prevents it from executing"
                onClick={this.toggleState}
              >
                <i className={stateClass} />
              </a>
              <a className="card-item-cog" href={ruleUrl} title="Edit alert rule">
                <i className="icon-gf icon-gf-settings" />
              </a>
            </div>
          </div>
          <div className="card-item-body">
            <div className="card-item-details">
              <div className="card-item-name">
                <a href={ruleUrl}>{rule.name}</a>
              </div>
              <div className="card-item-sub-name">
                <span className={`alert-list-item-state ${rule.stateClass}`}>
                  <i className={rule.stateIcon} /> {rule.stateText}
                </span>
                <span> for {rule.stateAge}</span>
              </div>
              {rule.info && <div className="small muted">{rule.info}</div>}
            </div>
          </div>
        </div>
      </li>
    );
  }
}
