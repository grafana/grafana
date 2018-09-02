import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import classNames from 'classnames';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import appEvents from 'app/core/app_events';
import Highlighter from 'react-highlight-words';
import { updateLocation } from 'app/core/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { NavModel, StoreState, AlertRule } from 'app/types';
import { getAlertRulesAsync } from './state/actions';

interface Props {
  navModel: NavModel;
  alertRules: AlertRule[];
  updateLocation: typeof updateLocation;
  getAlertRulesAsync: typeof getAlertRulesAsync;
}

interface State {
  rules: AlertRule[];
  search: string;
  stateFilter: string;
}

export class AlertRuleList extends PureComponent<Props, State> {
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

    this.state = {
      rules: [],
      search: '',
      stateFilter: '',
    };
  }

  componentDidMount() {
    this.fetchRules();
  }

  onStateFilterChanged = evt => {
    this.props.updateLocation({
      query: { state: evt.target.value },
    });
    this.fetchRules();
  };

  async fetchRules() {
    await this.props.getAlertRulesAsync();

    // this.props.alertList.loadRules({
    //   state: this.props.view.query.get('state') || 'all',
    // });
  }

  onOpenHowTo = () => {
    appEvents.emit('show-modal', {
      src: 'public/app/features/alerting/partials/alert_howto.html',
      modalClass: 'confirm-modal',
      model: {},
    });
  };

  onSearchQueryChange = evt => {
    // this.props.alertList.setSearchQuery(evt.target.value);
  };

  render() {
    const { navModel, alertRules } = this.props;
    const { search, stateFilter } = this.state;

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
                <select className="gf-form-input" onChange={this.onStateFilterChanged} value={stateFilter}>
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
              {alertRules.map(rule => <AlertRuleItem rule={rule} key={rule.id} search={search} />)}
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
  rule: AlertRule;
  search: string;
}

export class AlertRuleItem extends React.Component<AlertRuleItemProps, any> {
  toggleState = () => {
    // this.props.rule.togglePaused();
  };

  renderText(text: string) {
    return (
      <Highlighter
        highlightClassName="highlight-search-match"
        textToHighlight={text}
        searchWords={[this.props.search]}
      />
    );
  }

  render() {
    const { rule } = this.props;

    const stateClass = classNames({
      fa: true,
      'fa-play': rule.state === 'paused',
      'fa-pause': rule.state !== 'paused',
    });

    const ruleUrl = `${rule.url}?panelId=${rule.panelId}&fullscreen=true&edit=true&tab=alert`;

    return (
      <li className="alert-rule-item">
        <span className={`alert-rule-item__icon ${rule.stateClass}`}>
          <i className={rule.stateIcon} />
        </span>
        <div className="alert-rule-item__body">
          <div className="alert-rule-item__header">
            <div className="alert-rule-item__name">
              <a href={ruleUrl}>{this.renderText(rule.name)}</a>
            </div>
            <div className="alert-rule-item__text">
              <span className={`${rule.stateClass}`}>{this.renderText(rule.stateText)}</span>
              <span className="alert-rule-item__time"> for {rule.stateAge}</span>
            </div>
          </div>
          {rule.info && <div className="small muted alert-rule-item__info">{this.renderText(rule.info)}</div>}
        </div>

        <div className="alert-rule-item__actions">
          <button
            className="btn btn-small btn-inverse alert-list__btn width-2"
            title="Pausing an alert rule prevents it from executing"
            onClick={this.toggleState}
          >
            <i className={stateClass} />
          </button>
          <a className="btn btn-small btn-inverse alert-list__btn width-2" href={ruleUrl} title="Edit alert rule">
            <i className="icon-gf icon-gf-settings" />
          </a>
        </div>
      </li>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'alert-list'),
  alertRules: state.alertRules,
});

const mapDispatchToProps = {
  updateLocation,
  getAlertRulesAsync,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(AlertRuleList));
