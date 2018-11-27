import React, { PureComponent } from 'react';
import { JSONFormatter } from 'app/core/components/JSONFormatter/JSONFormatter';
import appEvents from 'app/core/app_events';
import { CopyToClipboard } from 'app/core/components/CopyToClipboard/CopyToClipboard';

interface DsQuery {
  isLoading: boolean;
  response: {};
}

interface Props {
  panel: any;
  LoadingPlaceholder: any;
}

interface State {
  allNodesExpanded: boolean;
  isMocking: boolean;
  mockedResponse: string;
  dsQuery: DsQuery;
}

export class QueryInspector extends PureComponent<Props, State> {
  formattedJson: any;
  clipboard: any;

  constructor(props) {
    super(props);
    this.state = {
      allNodesExpanded: null,
      isMocking: false,
      mockedResponse: '',
      dsQuery: {
        isLoading: false,
        response: {},
      },
    };
  }

  componentDidMount() {
    const { panel } = this.props;
    panel.events.on('refresh', this.onPanelRefresh);
    appEvents.on('ds-request-response', this.onDataSourceResponse);
    panel.refresh();
  }

  componentWillUnmount() {
    const { panel } = this.props;
    appEvents.off('ds-request-response', this.onDataSourceResponse);
    panel.events.off('refresh', this.onPanelRefresh);
  }

  handleMocking(response) {
    const { mockedResponse } = this.state;
    let mockedData;
    try {
      mockedData = JSON.parse(mockedResponse);
    } catch (err) {
      appEvents.emit('alert-error', ['R: Failed to parse mocked response']);
      return;
    }

    response.data = mockedData;
  }

  onPanelRefresh = () => {
    this.setState(prevState => ({
      ...prevState,
      dsQuery: {
        isLoading: true,
        response: {},
      },
    }));
  };

  onDataSourceResponse = (response: any = {}) => {
    // ignore if closed
    // if (!this.isOpen) {
    //   return;
    // }

    if (this.state.isMocking) {
      this.handleMocking(response);
      return;
    }

    // this.isLoading = false;
    // data = _.cloneDeep(data);
    response = { ...response }; // clone

    if (response.headers) {
      delete response.headers;
    }

    if (response.config) {
      response.request = response.config;
      delete response.config;
      delete response.request.transformRequest;
      delete response.request.transformResponse;
      delete response.request.paramSerializer;
      delete response.request.jsonpCallbackParam;
      delete response.request.headers;
      delete response.request.requestId;
      delete response.request.inspect;
      delete response.request.retry;
      delete response.request.timeout;
    }

    if (response.data) {
      response.response = response.data;

      // if (response.status === 200) {
      //   // if we are in error state, assume we automatically opened
      //   // and auto close it again
      //   if (this.hasError) {
      //     this.hasError = false;
      //     this.isOpen = false;
      //   }
      // }

      delete response.data;
      delete response.status;
      delete response.statusText;
      delete response.$$config;
    }
    this.setState(prevState => ({
      ...prevState,
      dsQuery: {
        isLoading: false,
        response: response,
      },
    }));
  };

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

  onToggleMocking = () => {
    this.setState(prevState => ({
      ...prevState,
      isMocking: !this.state.isMocking,
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

  setMockedResponse = evt => {
    const mockedResponse = evt.target.value;
    this.setState(prevState => ({
      ...prevState,
      mockedResponse,
    }));
  };

  render() {
    const { response, isLoading } = this.state.dsQuery;
    const { LoadingPlaceholder } = this.props;
    const { allNodesExpanded, isMocking } = this.state;
    const openNodes = this.getNrOfOpenNodes();

    if (isLoading) {
      return <LoadingPlaceholder text="Loading query inspector..." />;
    }

    return (
      <>
        {/* <div className="query-troubleshooter__header">
        <a className="pointer" ng-click="ctrl.toggleMocking()">Mock Response</a>
        */}
        <div>
          <button className="btn btn-transparent btn-p-x-0 m-r-1" onClick={this.onToggleMocking}>
            Mock response
          </button>
          <button className="btn btn-transparent btn-p-x-0 m-r-1" onClick={this.onToggleExpand}>
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
            className="btn btn-transparent btn-p-x-0"
            text={this.getTextForClipboard}
            onSuccess={this.onClipboardSuccess}
          >
            <i className="fa fa-clipboard" /> Copy to Clipboard
          </CopyToClipboard>
        </div>

        {!isMocking && <JSONFormatter json={response} open={openNodes} onDidRender={this.setFormattedJson} />}
        {isMocking && (
          <div className="query-troubleshooter__body">
            <div className="gf-form p-l-1 gf-form--v-stretch">
              <textarea
                className="gf-form-input"
                style={{ width: '95%' }}
                rows={10}
                onInput={this.setMockedResponse}
                placeholder="JSON"
              />
              {/* <textarea
                className="gf-form-input"
                style={{width: '95%'}}
                rows={10}
                ng-model="ctrl.mockedResponse"
                placeholder="JSON"></textarea> */}
            </div>
          </div>
        )}
      </>
    );
  }
}
