import React, { PureComponent } from 'react';

import { getBackendSrv } from '@grafana/runtime';
import { LoadingPlaceholder, JSONFormatter, Icon, HorizontalGroup, ClipboardButton } from '@grafana/ui';

import { DashboardModel, PanelModel } from '../dashboard/state';

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
    model.panels = model.panels.map((dashPanel) => {
      return dashPanel.id === panel.id ? panel.getSaveModel() : dashPanel;
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

  onToggleExpand = () => {
    this.setState((prevState) => ({
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
          <HorizontalGroup spacing="md">
            <div onClick={this.onToggleExpand}>{this.renderExpandCollapse()}</div>
            <ClipboardButton getText={this.getTextForClipboard} icon="copy">
              Copy to Clipboard
            </ClipboardButton>
          </HorizontalGroup>
        </div>

        <JSONFormatter json={testRuleResponse} open={openNodes} onDidRender={this.setFormattedJson} />
      </>
    );
  }
}
