import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { Subscription } from 'rxjs';

import { LoadingState, PanelData } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Stack } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Button, ClipboardButton, JSONFormatter, LoadingPlaceholder } from '@grafana/ui';
import { backendSrv } from 'app/core/services/backend_srv';

import { getPanelInspectorStyles } from './styles';

interface ExecutedQueryInfo {
  refId: string;
  query: string;
  frames: number;
  rows: number;
}

interface Props {
  data: PanelData;
  onRefreshQuery: () => void;
}

interface State {
  allNodesExpanded: boolean | null;
  isMocking: boolean;
  mockedResponse: string;
  response: {};
  executedQueries: ExecutedQueryInfo[];
}

export class QueryInspector extends PureComponent<Props, State> {
  private formattedJson: any;
  private subs = new Subscription();

  constructor(props: Props) {
    super(props);
    this.state = {
      executedQueries: [],
      allNodesExpanded: null,
      isMocking: false,
      mockedResponse: '',
      response: {},
    };
  }

  componentDidMount() {
    this.subs.add(
      backendSrv.getInspectorStream().subscribe({
        next: (response) => this.onDataSourceResponse(response),
      })
    );
  }

  componentDidUpdate(oldProps: Props) {
    if (this.props.data !== oldProps.data) {
      this.updateQueryList();
    }
  }

  /**
   * Find the list of executed queries
   */
  updateQueryList() {
    const { data } = this.props;
    const frames = data.series;
    const executedQueries: ExecutedQueryInfo[] = [];

    if (frames?.length) {
      let last: ExecutedQueryInfo | undefined = undefined;

      frames.forEach((frame, idx) => {
        const query = frame.meta?.executedQueryString;

        if (query) {
          const refId = frame.refId || '?';

          if (last?.refId === refId) {
            last.frames++;
            last.rows += frame.length;
          } else {
            last = {
              refId,
              frames: 0,
              rows: frame.length,
              query,
            };
            executedQueries.push(last);
          }
        }
      });
    }

    this.setState({ executedQueries });
  }

  componentWillUnmount() {
    this.subs.unsubscribe();
  }

  onDataSourceResponse(response: any) {
    // ignore silent requests
    if (response.config?.hideFromInspector) {
      return;
    }

    response = { ...response }; // clone - dont modify the response

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

      delete response.config;
      delete response.data;
      delete response.status;
      delete response.statusText;
      delete response.ok;
      delete response.url;
      delete response.redirected;
      delete response.type;
      delete response.$$config;
    }

    this.setState({
      response: response,
    });
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

  onToggleMocking = () => {
    this.setState((prevState) => ({
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

  renderExecutedQueries(executedQueries: ExecutedQueryInfo[]) {
    if (!executedQueries.length) {
      return null;
    }

    const styles = {
      refId: css`
        font-weight: ${config.theme.typography.weight.semibold};
        color: ${config.theme.colors.textBlue};
        margin-right: 8px;
      `,
    };

    return (
      <div>
        {executedQueries.map((info) => {
          return (
            <Stack key={info.refId} gap={1} direction="column">
              <div>
                <span className={styles.refId}>{info.refId}:</span>
                {info.frames > 1 && <span>{info.frames} frames, </span>}
                <span>{info.rows} rows</span>
              </div>
              <pre>{info.query}</pre>
            </Stack>
          );
        })}
      </div>
    );
  }

  render() {
    const { allNodesExpanded, executedQueries, response } = this.state;
    const { onRefreshQuery, data } = this.props;
    const openNodes = this.getNrOfOpenNodes();
    const styles = getPanelInspectorStyles();
    const haveData = Object.keys(response).length > 0;
    const isLoading = data.state === LoadingState.Loading;

    return (
      <div className={styles.wrap}>
        <div aria-label={selectors.components.PanelInspector.Query.content}>
          <h3 className="section-heading">Query inspector</h3>
          <p className="small muted">
            Query inspector allows you to view raw request and response. To collect this data Grafana needs to issue a
            new query. Click refresh button below to trigger a new query.
          </p>
        </div>
        {this.renderExecutedQueries(executedQueries)}
        <div className={styles.toolbar}>
          <Button
            icon="sync"
            onClick={onRefreshQuery}
            aria-label={selectors.components.PanelInspector.Query.refreshButton}
          >
            Refresh
          </Button>

          {haveData && allNodesExpanded && (
            <Button icon="minus" variant="secondary" className={styles.toolbarItem} onClick={this.onToggleExpand}>
              Collapse all
            </Button>
          )}
          {haveData && !allNodesExpanded && (
            <Button icon="plus" variant="secondary" className={styles.toolbarItem} onClick={this.onToggleExpand}>
              Expand all
            </Button>
          )}

          {haveData && (
            <ClipboardButton
              getText={this.getTextForClipboard}
              className={styles.toolbarItem}
              icon="copy"
              variant="secondary"
            >
              Copy to clipboard
            </ClipboardButton>
          )}
          <div className="flex-grow-1" />
        </div>
        <div className={styles.content}>
          {isLoading && <LoadingPlaceholder text="Loading query inspector..." />}
          {!isLoading && haveData && (
            <JSONFormatter json={response} open={openNodes} onDidRender={this.setFormattedJson} />
          )}
          {!isLoading && !haveData && (
            <p className="muted">No request and response collected yet. Hit refresh button</p>
          )}
        </div>
      </div>
    );
  }
}
