import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { SelectableValue } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { Button, FilterInput, LinkButton, Select, VerticalGroup, InlineField } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { AlertRule, StoreState } from 'app/types';

import { ShowModalReactEvent } from '../../types/events';

import { AlertHowToModal } from './AlertHowToModal';
import AlertRuleItem from './AlertRuleItem';
import { DeprecationNotice } from './components/DeprecationNotice';
import { getAlertRulesAsync, togglePauseAlertRule } from './state/actions';
import { setSearchQuery } from './state/reducers';
import { getAlertRuleItems, getSearchQuery } from './state/selectors';

function mapStateToProps(state: StoreState) {
  return {
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
    const { alertRules, search, isLoading } = this.props;

    return (
      <Page navId="alert-list">
        <Page.Contents isLoading={isLoading}>
          <div className="page-action-bar">
            <InlineField grow="true">
              <FilterInput placeholder="Search alerts" value={search} onChange={this.onSearchQueryChange} />
            </InlineField>
            <div className="gf-form">
              <label className="gf-form-label" htmlFor="alert-state-filter">
                States
              </label>

              <div className="width-13">
                <Select
                  inputId={'alert-state-filter'}
                  options={this.stateFilters}
                  onChange={this.onStateFilterChanged}
                  value={this.getStateFilter()}
                />
              </div>
            </div>
            <div className="page-action-bar__spacer" />
            {config.unifiedAlertingEnabled && (
              <LinkButton variant="primary" href="alerting/ng/new">
                Add NG Alert
              </LinkButton>
            )}
            <Button variant="secondary" onClick={this.onOpenHowTo}>
              How to add an alert
            </Button>
          </div>
          <DeprecationNotice />
          <VerticalGroup spacing="none">
            {alertRules.map((rule) => {
              return (
                <AlertRuleItem
                  rule={rule}
                  key={rule.id}
                  search={search}
                  onTogglePause={() => this.onTogglePause(rule)}
                />
              );
            })}
          </VerticalGroup>
        </Page.Contents>
      </Page>
    );
  }
}

export default connector(AlertRuleListUnconnected);
