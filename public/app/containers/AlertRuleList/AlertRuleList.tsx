import React from 'react';
import classNames from 'classnames';
import { inject, observer } from 'mobx-react';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import { IAlertRule } from 'app/stores/AlertListStore/AlertListStore';
import appEvents from 'app/core/app_events';
import IContainerProps from 'app/containers/IContainerProps';
import Highlighter from 'react-highlight-words';

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
    this.state = { search: '' };
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

  onSearchFilter(event) {
    this.setState({ search: event.target.value });
  }

  render() {
    const { nav, alertList } = this.props;

    let regex = new RegExp(this.state.search, 'i');

    return (
      <div>
        <PageHeader model={nav as any} />
        <div className="page-container page-body">
          <div className="page-action-bar">
            <div className="gf-form">
              <label className="gf-form--has-input-icon">
                <input
                  type="text"
                  className="gf-form-input width-13"
                  placeholder="Search alert"
                  value={this.state.search}
                  onChange={this.onSearchFilter.bind(this)}
                />
                <i className="gf-form-input-icon fa fa-search" />
              </label>
            </div>
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

          <section>
            <ol className="alert-rule-list">
              {alertList
                .searchFilter(regex)
                .map(rule => <AlertRuleItem rule={rule} key={rule.id} search={this.state.search} />)}
            </ol>
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
  search: string;
}

@observer
export class AlertRuleItem extends React.Component<AlertRuleItemProps, any> {
  toggleState = () => {
    this.props.rule.togglePaused();
  };

  renderText(text: string, searchArray) {
    return <Highlighter highlightClassName="highlight" textToHighlight={text} searchWords={searchArray} />;
  }

  render() {
    const { rule } = this.props;

    const searchArray = [this.props.search];

    let stateClass = classNames({
      fa: true,
      'fa-play': rule.isPaused,
      'fa-pause': !rule.isPaused,
    });

    let ruleUrl = `dashboard/${rule.dashboardUri}?panelId=${rule.panelId}&fullscreen&edit&tab=alert`;

    return (
      <li className="alert-rule-item">
        <div className="alert-rule-item__body">
          <span className={`alert-rule-item__icon ${rule.stateClass}`}>
            <i className={rule.stateIcon} />
          </span>
          <div className="alert-rule-item__header">
            <div className="alert-rule-item__name">
              <a href={ruleUrl}>{this.renderText(rule.name, searchArray)}</a>
            </div>
            <div className="alert-rule-item__text">
              <span className={`${rule.stateClass}`}>{this.renderText(rule.stateText, searchArray)}</span>
              <span className="alert-rule-item__time"> for {rule.stateAge}</span>
            </div>
          </div>
          {rule.info && (
            <div className="small muted alert-rule-item__info">{this.renderText(rule.info, searchArray)}</div>
          )}
        </div>
        <div className="alert-rule-item__footer">
          <a
            className="btn btn-small btn-inverse alert-list__btn width-2"
            title="Pausing an alert rule prevents it from executing"
            onClick={this.toggleState}
          >
            <i className={stateClass} />
          </a>
          <a className="btn btn-small btn-inverse alert-list__btn width-2" href={ruleUrl} title="Edit alert rule">
            <i className="icon-gf icon-gf-settings" />
          </a>
        </div>
      </li>
    );
  }
}
