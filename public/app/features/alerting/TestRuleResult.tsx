import React, { PureComponent } from 'react';
import { LoadingPlaceholder, JSONFormatter, Icon } from '@grafana/ui';

import appEvents from 'app/core/app_events';
import { CopyToClipboard } from 'app/core/components/CopyToClipboard/CopyToClipboard';
import { DashboardModel, PanelModel } from '../dashboard/state';
import { getBackendSrv } from '@grafana/runtime';
import { AppEvents } from '@grafana/data';

export interface Props {
  dashboard: DashboardModel;
  panel: PanelModel;
}

interface State {
  isLoading: boolean;
  allNodesExpanded: boolean | null;
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
    const { dashboard, panel } = this.props;

    // dashboard save model
    const model = dashboard.getSaveModelClone();

    // now replace panel to get current edits
    model.panels = model.panels.map(dashPanel => {
      return dashPanel.id === panel.editSourceId ? panel.getSaveModel() : dashPanel;
    });

    const payload = { dashboard: model, panelId: panel.id };

    this.setState({ isLoading: true });
    const testRuleResponse = await getBackendSrv().post(`/api/alerts/test`, payload);
    this.setState({ isLoading: false, testRuleResponse });
  }

  setFormattedJson = (formattedJson: any) => {
    this.formattedJson = formattedJson;
  };

  getTextForClipboard = () => {
    return JSON.stringify(this.formattedJson, null, 2);
  };

  onClipboardSuccess = () => {
    appEvents.emit(AppEvents.alertSuccess, ['Content copied to clipboard']);
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
        <Icon name="minus-circle" /> Collapse All
      </>
    );
    const expand = (
      <>
        <Icon name="plus-circle" /> Expand All
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
            <Icon name="copy" /> Copy to Clipboard
          </CopyToClipboard>
        </div>

        <JSONFormatter json={testRuleResponse} open={openNodes} onDidRender={this.setFormattedJson} />
      </>
    );
  }
}
