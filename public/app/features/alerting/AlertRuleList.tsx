import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect, ConnectedProps } from 'react-redux';
import Page from 'app/core/components/Page/Page';
import AlertRuleItem from './AlertRuleItem';
import appEvents from 'app/core/app_events';
import { getNavModel } from 'app/core/selectors/navModel';
import { AlertRule, StoreState } from 'app/types';
import { getAlertRulesAsync, togglePauseAlertRule } from './state/actions';
import { getAlertRuleItems, getSearchQuery } from './state/selectors';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';
import { SelectableValue } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { setSearchQuery } from './state/reducers';
import { Button, LinkButton, Select, VerticalGroup } from '@grafana/ui';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { ShowModalReactEvent } from '../../types/events';
import { AlertHowToModal } from './AlertHowToModal';

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, 'alert-list'),
    alertRules: getAlertRuleItems(state),
    search: getSearchQuery(state.alertRules),
    isLoading: state.alertRules.isLoading,
  };
}

const mapDispatchToProps = {
  getAlertRulesAsync,
  setSearchQuery,
  togglePauseAlertRule,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

interface OwnProps extends GrafanaRouteComponentProps<{}, { state: string }> {}

export type Props = OwnProps & ConnectedProps<typeof connector>;

export class AlertRuleListUnconnected extends PureComponent<Props> {
  stateFilters = [
    { label: 'All', value: 'all' },
    { label: 'OK', value: 'ok' },
    { label: 'Not OK', value: 'not_ok' },
    { label: 'Alerting', value: 'alerting' },
    { label: 'No data', value: 'no_data' },
    { label: 'Paused', value: 'paused' },
    { label: 'Pending', value: 'pending' },
  ];

  componentDidMount() {
    this.fetchRules();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.queryParams.state !== this.props.queryParams.state) {
      this.fetchRules();
    }
  }

  async fetchRules() {
    await this.props.getAlertRulesAsync({ state: this.getStateFilter() });
  }

  getStateFilter(): string {
    return this.props.queryParams.state ?? 'all';
  }

  onStateFilterChanged = (option: SelectableValue) => {
    locationService.partial({ state: option.value });
  };

  onOpenHowTo = () => {
    appEvents.publish(new ShowModalReactEvent({ component: AlertHowToModal }));
  };

  onSearchQueryChange = (value: string) => {
    this.props.setSearchQuery(value);
  };

  onTogglePause = (rule: AlertRule) => {
    this.props.togglePauseAlertRule(rule.id, { paused: rule.state !== 'paused' });
  };

  alertStateFilterOption = ({ text, value }: { text: string; value: string }) => {
    return (
      <option key={value} value={value}>
        {text}
      </option>
    );
  };

  render() {
    const { navModel, alertRules, search, isLoading } = this.props;

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={isLoading}>
          <div className="page-action-bar">
            <div className="gf-form gf-form--grow">
              <FilterInput placeholder="Search alerts" value={search} onChange={this.onSearchQueryChange} />
            </div>
            <div className="gf-form">
              <label className="gf-form-label">States</label>

              <div className="width-13">
                <Select
                  menuShouldPortal
                  options={this.stateFilters}
                  onChange={this.onStateFilterChanged}
                  value={this.getStateFilter()}
                />
              </div>
            </div>
            <div className="page-action-bar__spacer" />
            {config.featureToggles.ngalert && (
              <LinkButton variant="primary" href="alerting/ng/new">
                Add NG Alert
              </LinkButton>
            )}
            <Button variant="secondary" onClick={this.onOpenHowTo}>
              How to add an alert
            </Button>
          </div>
          <VerticalGroup spacing="none">
            {alertRules.map((rule) => {
              return (
                <AlertRuleItem
                  rule={rule as AlertRule}
                  key={rule.id}
                  search={search}
                  onTogglePause={() => this.onTogglePause(rule as AlertRule)}
                />
              );
            })}
          </VerticalGroup>
        </Page.Contents>
      </Page>
    );
  }
}

export default hot(module)(connector(AlertRuleListUnconnected));
