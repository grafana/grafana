// Library
import React, { Component } from 'react';

// Types
import { TimeRange, LoadingState, DataQueryOptions, DataQueryResponse, TimeSeries } from 'app/types';
import { DataSourceApi } from 'app/types/series';

interface RenderProps {
  loading: LoadingState;
  timeSeries: TimeSeries[];
}

export interface Props {
  dataSourceApi: DataSourceApi;
  queries: any[];
  panelId?: number;
  dashboardId?: number;
  isVisible?: boolean;
  timeRange?: TimeRange;
  refreshCounter: number;
  children: (r: RenderProps) => JSX.Element;
  onIssueQueryResponse: any;
}

export interface State {
  isFirstLoad: boolean;
  loading: LoadingState;
  response: DataQueryResponse;
}

export class DataPanel extends Component<Props, State> {
  static defaultProps = {
    isVisible: true,
    panelId: 1,
    dashboardId: 1,
  };

  constructor(props: Props) {
    super(props);
    this.state = {
      loading: LoadingState.NotStarted,
      response: {
        data: [],
      },
      isFirstLoad: true,
    };
  }

  componentDidMount() {
    console.log('DataPanel mount');
  }

  async componentDidUpdate(prevProps: Props) {
    if (!this.hasPropsChanged(prevProps)) {
      return;
    }

    this.issueQueries();
  }

  hasPropsChanged(prevProps: Props) {
    const { refreshCounter, isVisible, dataSourceApi } = this.props;

    return (
      refreshCounter !== prevProps.refreshCounter ||
      isVisible !== prevProps.isVisible ||
      dataSourceApi !== prevProps.dataSourceApi
    );
  }

  issueQueries = async () => {
    const { isVisible, queries, panelId, dashboardId, timeRange, dataSourceApi } = this.props;

    if (!isVisible || !dataSourceApi) {
      return;
    }

    if (!queries.length) {
      this.setState({ loading: LoadingState.Done });
      return;
    }

    this.setState({ loading: LoadingState.Loading });

    try {
      const queryOptions: DataQueryOptions = {
        timezone: 'browser',
        panelId: panelId,
        dashboardId: dashboardId,
        range: timeRange,
        rangeRaw: timeRange.raw,
        interval: '1s',
        intervalMs: 60000,
        targets: queries,
        maxDataPoints: 500,
        scopedVars: {},
        cacheTimeout: null,
      };

      console.log('Issuing DataPanel query', queryOptions);
      const resp = await dataSourceApi.query(queryOptions);
      console.log('Issuing DataPanel query Resp', resp);

      this.setState({
        loading: LoadingState.Done,
        response: resp,
        isFirstLoad: false,
      });

      this.props.onIssueQueryResponse(resp.data);
    } catch (err) {
      console.log('Loading error', err);
      this.setState({ loading: LoadingState.Error, isFirstLoad: false });
    }
  };

  render() {
    const { response, loading, isFirstLoad } = this.state;
    console.log('data panel render');
    const timeSeries = response.data;

    if (isFirstLoad && (loading === LoadingState.Loading || loading === LoadingState.NotStarted)) {
      return (
        <div className="loading">
          <p>Loading</p>
        </div>
      );
    }

    return (
      <>
        {this.loadingSpinner}
        {this.props.children({
          timeSeries,
          loading,
        })}
      </>
    );
  }

  private get loadingSpinner(): JSX.Element {
    const { loading } = this.state;

    if (loading === LoadingState.Loading) {
      return (
        <div className="panel__loading">
          <i className="fa fa-spinner fa-spin" />
        </div>
      );
    }

    return null;
  }
}
