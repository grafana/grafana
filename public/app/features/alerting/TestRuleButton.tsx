import React, { PureComponent } from 'react';
import { JSONFormatter } from 'app/core/components/JSONFormatter/JSONFormatter';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { DashboardModel } from '../dashboard/dashboard_model';

export interface Props {
  panelId: number;
  dashboard: DashboardModel;
  LoadingPlaceholder: any;
}

interface State {
  isLoading: boolean;
  testRuleResponse: {};
}

export class TestRuleButton extends PureComponent<Props, State> {
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
    const testRuleResponse = await getBackendSrv().post(`/api/alerts/test`, payload);
    this.setState(prevState => ({ ...prevState, isLoading: false, testRuleResponse }));
  }

  render() {
    const { testRuleResponse, isLoading } = this.state;
    const { LoadingPlaceholder } = this.props;

    if (isLoading === true) {
      return <LoadingPlaceholder text="Evaluating rule" />;
    }

    return <JSONFormatter json={testRuleResponse} />;
  }
}
