import React, { PureComponent } from 'react';
import { JSONFormatter } from 'app/core/components/JSONFormatter/JSONFormatter';
import appEvents from 'app/core/app_events';
import { CopyToClipboard } from 'app/core/components/CopyToClipboard/CopyToClipboard';

interface Props {
  response: any;
}

interface State {
  allNodesExpanded: boolean;
}

export class QueryInspector extends PureComponent<Props, State> {
  formattedJson: any;
  clipboard: any;

  constructor(props) {
    super(props);

    this.state = {
      allNodesExpanded: null,
    };
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
      return 3;
    } else if (this.state.allNodesExpanded) {
      return 20;
    }
    return 1;
  };

  render() {
    const { response } = this.props;
    const { allNodesExpanded } = this.state;
    const openNodes = this.getNrOfOpenNodes();
    return (
      <>
        {/* <div className="query-troubleshooter__header">
        <a className="pointer" ng-click="ctrl.toggleMocking()">Mock Response</a>
        <a className="pointer" ng-click="ctrl.toggleExpand()" ng-hide="ctrl.allNodesExpanded">
        <i className="fa fa-plus-square-o"></i> Expand All
        </a>
        <a className="pointer ng-hide" ng-click="ctrl.toggleExpand()" ng-show="ctrl.allNodesExpanded">
        <i className="fa fa-minus-square-o"></i> Collapse All
        </a>
        <a className="pointer ng-isolate-scope" clipboard-button="ctrl.getClipboardText()"><i className="fa fa-clipboard"></i> Copy to Clipboard</a>

        </div> */}
        {/* <button onClick={this.copyToClipboard}>Copy</button>
        <button ref={this.copyButtonRef}>Copy2</button> */}
        <button className="btn btn-transparent" onClick={this.onToggleExpand}>
          {allNodesExpanded ? (
            <>
              <i className="fa fa-minus-square-o" /> Collapse All
            </>
          ) : (
            <>
              <i className="fa fa-plus-square-o" /> Expand All
            </>
          )}
        </button>

        <CopyToClipboard
          className="btn btn-transparent"
          text={this.getTextForClipboard}
          onSuccess={this.onClipboardSuccess}
        >
          <>
            <i className="fa fa-clipboard" /> Copy to Clipboard
          </>
        </CopyToClipboard>
        <JSONFormatter json={response} open={openNodes} onDidRender={this.setFormattedJson} />
      </>
    );
  }
}
