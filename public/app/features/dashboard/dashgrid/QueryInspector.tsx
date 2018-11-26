import React, { PureComponent } from 'react';
import { JSONFormatter } from 'app/core/components/JSONFormatter/JSONFormatter';
import appEvents from 'app/core/app_events';
import { CopyToClipboard } from 'app/core/components/CopyToClipboard/CopyToClipboard';

interface Props {
  response: any;
}

export class QueryInspector extends PureComponent<Props> {
  formattedJson: any;
  clipboard: any;

  constructor(props) {
    super(props);
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

  render() {
    const { response } = this.props;
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

        <CopyToClipboard
          className="btn btn-transparent"
          text={this.getTextForClipboard}
          onSuccess={this.onClipboardSuccess}
        >
          <>
            <i className="fa fa-clipboard" /> Copy to Clipboard
          </>
        </CopyToClipboard>
        <JSONFormatter json={response} onDidRender={this.setFormattedJson} />
      </>
    );
  }
}
