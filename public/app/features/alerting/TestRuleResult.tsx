import React, { PureComponent } from 'react';
import { JSONFormatter } from 'app/core/components/JSONFormatter/JSONFormatter';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { DashboardModel } from '../dashboard/state/DashboardModel';
import { LoadingPlaceholder } from '@grafana/ui/src';

export interface Props {
  panelId: number;
  dashboard: DashboardModel;
}

interface State {
  isLoading: boolean;
  testRuleResponse: {};
}

export class TestRuleResult extends PureComponent<Props, State> {
  readonly state: State = {
    isLoading: false,
    testRuleResponse: {},
  };

  componentDidMount() {
    this.testRule();
  }

  async testRule() {
    const { panelId, dashboard } = this.props;
    const payload = { dashboard: dashboard.getSaveModelClone(), panelId };

    this.setState({ isLoading: true });
    const testRuleResponse = await getBackendSrv().post(`/api/alerts/test`, payload);
    this.setState({ isLoading: false, testRuleResponse });
  }

  render() {
    const { testRuleResponse, isLoading } = this.state;

    if (isLoading === true) {
      return <LoadingPlaceholder text="Evaluating rule" />;
    }

    return <JSONFormatter json={testRuleResponse} />;
  }
}
