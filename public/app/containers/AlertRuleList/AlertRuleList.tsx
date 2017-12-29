import React from 'react';
import classNames from 'classnames';
import { inject, observer } from 'mobx-react';
import PageHeader from 'app/core/components/PageHeader/PageHeader';

export interface IProps {
  store: any;
}

@inject('store')
@observer
export class AlertRuleList extends React.Component<IProps, any> {
  constructor(props) {
    super(props);

    this.props.store.nav.load('alerting', 'alert-list');
    this.props.store.alerting.loadRules();
  }

  render() {
    return (
      <div>
        <PageHeader model={this.props.store.nav} />
        <div className="page-container page-body">
          <div className="page-action-bar">
            <div className="gf-form">
              <label className="gf-form-label">Filter by state</label>

              <div className="gf-form-select-wrapper width-13">
                <select
                  className="gf-form-input"
                  ng-model="ctrl.filters.state"
                  ng-options="f.value as f.text for f in ctrl.stateFilters"
                  ng-change="ctrl.filtersChanged()"
                />
              </div>
            </div>

            <div className="page-action-bar__spacer" />

            <a className="btn btn-secondary" ng-click="ctrl.openHowTo()">
              <i className="fa fa-info-circle" /> How to add an alert
            </a>
          </div>

          <section className="card-section card-list-layout-list">
            <ol className="card-list">{this.props.store.alerting.rules.map(AlertRuleItem)}</ol>
          </section>
        </div>
      </div>
    );
  }
}

function AlertRuleItem(rule) {
  let stateClass = classNames({
    fa: true,
    'fa-play': rule.state === 'paused',
    'fa-pause': rule.state !== 'paused',
  });

  let ruleUrl = `dashboard/${rule.dashboardUri}?panelId=${rule.panelId}&fullscreen&edit&tab=alert`;

  return (
    <li className="card-item-wrapper" key={rule.id}>
      <div className="card-item card-item--alert">
        <div className="card-item-header">
          <div className="card-item-type">
            <a className="card-item-cog" title="Pausing an alert rule prevents it from executing">
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
