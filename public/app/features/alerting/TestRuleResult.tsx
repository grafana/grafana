import React, { PureComponent } from 'react';
import { JSONFormatter } from 'app/core/components/JSONFormatter/JSONFormatter';
import appEvents from 'app/core/app_events';
import { CopyToClipboard } from 'app/core/components/CopyToClipboard/CopyToClipboard';
import { getBackendSrv } from '@grafana/runtime';
import { DashboardModel } from '../dashboard/state/DashboardModel';
import { LoadingPlaceholder } from '@grafana/ui/src';

export interface Props {
  panelId: number;
  dashboard: DashboardModel;
}

interface State {
  isLoading: boolean;
  allNodesExpanded: boolean;
  testRuleResponse: {};
}

export class TestRuleResult extends PureComponent<Props, State> {
  readonly state: State = {
    isLoading: false,
    allNodesExpanded: null,
    testRuleResponse: {},
  };

  formattedJson: any;
  clipboard: any;

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

  setFormattedJson = formattedJson => {
    this.formattedJson = formattedJson;
  };

  getTextForClipboard = () => {
    return JSON.stringify(this.formattedJson, null, 2);
  };

  onClipboardSuccess = () => {
    appEvents.emit('alert-success', ['Content copied to clipboard']);
  };

  onToggleExpand = () => {
    this.setState(prevState => ({
      ...prevState,
      allNodesExpanded: !this.state.allNodesExpanded,
    }));
  };

  getNrOfOpenNodes = () => {
    if (this.state.allNodesExpanded === null) {
      return 3; // 3 is default, ie when state is null
    } else if (this.state.allNodesExpanded) {
      return 20;
    }
    return 1;
  };

  renderExpandCollapse = () => {
    const { allNodesExpanded } = this.state;

    const collapse = (
      <>
        <i className="fa fa-minus-square-o" /> Collapse All
      </>
    );
    const expand = (
      <>
        <i className="fa fa-plus-square-o" /> Expand All
      </>
    );
    return allNodesExpanded ? collapse : expand;
  };

  render() {
    const { testRuleResponse, isLoading } = this.state;

    if (isLoading === true) {
      return <LoadingPlaceholder text="Evaluating rule" />;
    }

    const openNodes = this.getNrOfOpenNodes();

    return (
      <>
        <div className="pull-right">
          <button className="btn btn-transparent btn-p-x-0 m-r-1" onClick={this.onToggleExpand}>
            {this.renderExpandCollapse()}
          </button>
          <CopyToClipboard
            className="btn btn-transparent btn-p-x-0"
            text={this.getTextForClipboard}
            onSuccess={this.onClipboardSuccess}
          >
            <i className="fa fa-clipboard" /> Copy to Clipboard
          </CopyToClipboard>
        </div>

        <JSONFormatter json={testRuleResponse} open={openNodes} onDidRender={this.setFormattedJson} />
      </>
    );
  }
}
