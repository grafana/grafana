import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import AlertRuleItem from './AlertRuleItem';
import appEvents from 'app/core/app_events';
import { updateLocation } from 'app/core/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { NavModel, StoreState, AlertRule } from 'app/types';
import { getAlertRulesAsync, setSearchQuery, togglePauseAlertRule } from './state/actions';
import { getAlertRuleItems, getSearchQuery } from './state/selectors';

export interface Props {
  navModel: NavModel;
  alertRules: AlertRule[];
  updateLocation: typeof updateLocation;
  getAlertRulesAsync: typeof getAlertRulesAsync;
  setSearchQuery: typeof setSearchQuery;
  togglePauseAlertRule: typeof togglePauseAlertRule;
  stateFilter: string;
  search: string;
}

export class AlertRuleList extends PureComponent<Props, any> {
  stateFilters = [
    { text: 'All', value: 'all' },
    { text: 'OK', value: 'ok' },
    { text: 'Not OK', value: 'not_ok' },
    { text: 'Alerting', value: 'alerting' },
    { text: 'No Data', value: 'no_data' },
    { text: 'Paused', value: 'paused' },
    { text: 'Pending', value: 'pending' },
  ];

  componentDidMount() {
    this.fetchRules();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.stateFilter !== this.props.stateFilter) {
      this.fetchRules();
    }
  }

  async fetchRules() {
    await this.props.getAlertRulesAsync({ state: this.getStateFilter() });
  }

  getStateFilter(): string {
    const { stateFilter } = this.props;
    if (stateFilter) {
      return stateFilter.toString();
    }
    return 'all';
  }

  onStateFilterChanged = event => {
    this.props.updateLocation({
      query: { state: event.target.value },
    });
  };

  onOpenHowTo = () => {
    appEvents.emit('show-modal', {
      src: 'public/app/features/alerting/partials/alert_howto.html',
      modalClass: 'confirm-modal',
      model: {},
    });
  };

  onSearchQueryChange = event => {
    const { value } = event.target;
    this.props.setSearchQuery(value);
  };

  onTogglePause = (rule: AlertRule) => {
    this.props.togglePauseAlertRule(rule.id, { paused: rule.state !== 'paused' });
  };

  alertStateFilterOption = ({ text, value }) => {
    return (
      <option key={value} value={value}>
        {text}
      </option>
    );
  };

  render() {
    const { navModel, alertRules, search } = this.props;

    return (
      <div>
        <PageHeader model={navModel} />
        <div className="page-container page-body">
          <div className="page-action-bar">
            <div className="gf-form gf-form--grow">
              <label className="gf-form--has-input-icon gf-form--grow">
                <input
                  type="text"
                  className="gf-form-input"
                  placeholder="Search alerts"
                  value={search}
                  onChange={this.onSearchQueryChange}
                />
                <i className="gf-form-input-icon fa fa-search" />
              </label>
            </div>
            <div className="gf-form">
              <label className="gf-form-label">States</label>

              <div className="gf-form-select-wrapper width-13">
                <select className="gf-form-input" onChange={this.onStateFilterChanged} value={this.getStateFilter()}>
                  {this.stateFilters.map(this.alertStateFilterOption)}
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
              {alertRules.map(rule => (
                <AlertRuleItem
                  rule={rule}
                  key={rule.id}
                  search={search}
                  onTogglePause={() => this.onTogglePause(rule)}
                />
              ))}
            </ol>
          </section>
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'alert-list'),
  alertRules: getAlertRuleItems(state.alertRules),
  stateFilter: state.location.query.state,
  search: getSearchQuery(state.alertRules),
});

const mapDispatchToProps = {
  updateLocation,
  getAlertRulesAsync,
  setSearchQuery,
  togglePauseAlertRule,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(AlertRuleList));
