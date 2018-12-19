// Library
import React, { Component } from 'react';

// Services
import { getDatasourceSrv, DatasourceSrv } from 'app/features/plugins/datasource_srv';

// Utils
import kbn from 'app/core/utils/kbn';

// Types
import { TimeRange, LoadingState, DataQueryOptions, DataQueryResponse, TimeSeries } from 'app/types';

interface RenderProps {
  loading: LoadingState;
  timeSeries: TimeSeries[];
}

export interface Props {
  datasource: string | null;
  queries: any[];
  panelId?: number;
  dashboardId?: number;
  isVisible?: boolean;
  timeRange?: TimeRange;
  widthPixels: number;
  refreshCounter: number;
  minInterval?: string;
  maxDataPoints?: number;
  children: (r: RenderProps) => JSX.Element;
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

  dataSourceSrv: DatasourceSrv = getDatasourceSrv();
  isUnmounted = false;

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
    this.issueQueries();
  }

  componentWillUnmount() {
    this.isUnmounted = true;
  }

  async componentDidUpdate(prevProps: Props) {
    if (!this.hasPropsChanged(prevProps)) {
      return;
    }

    this.issueQueries();
  }

  hasPropsChanged(prevProps: Props) {
    return this.props.refreshCounter !== prevProps.refreshCounter;
  }

  private issueQueries = async () => {
    const { isVisible, queries, datasource, panelId, dashboardId, timeRange, widthPixels, maxDataPoints } = this.props;

    if (!isVisible) {
      return;
    }

    if (!queries.length) {
      this.setState({ loading: LoadingState.Done });
      return;
    }

    this.setState({ loading: LoadingState.Loading });

    try {
      const ds = await this.dataSourceSrv.get(datasource);

      // TODO interpolate variables
      const minInterval = this.props.minInterval || ds.interval;
      const intervalRes = kbn.calculateInterval(timeRange, widthPixels, minInterval);

      const queryOptions: DataQueryOptions = {
        timezone: 'browser',
        panelId: panelId,
        dashboardId: dashboardId,
        range: timeRange,
        rangeRaw: timeRange.raw,
        interval: intervalRes.interval,
        intervalMs: intervalRes.intervalMs,
        targets: queries,
        maxDataPoints: maxDataPoints || widthPixels,
        scopedVars: {},
        cacheTimeout: null,
      };

      console.log('Issuing DataPanel query', queryOptions);
      const resp = await ds.query(queryOptions);
      console.log('Issuing DataPanel query Resp', resp);

      if (this.isUnmounted) {
        return;
      }

      this.setState({
        loading: LoadingState.Done,
        response: resp,
        isFirstLoad: false,
      });
    } catch (err) {
      console.log('Loading error', err);
      this.setState({ loading: LoadingState.Error, isFirstLoad: false });
    }
  };

  render() {
    const { queries } = this.props;
    const { response, loading, isFirstLoad } = this.state;

    const timeSeries = response.data;

    if (isFirstLoad && loading === LoadingState.Loading) {
      return this.renderLoadingSpinner();
    }

    if (!queries.length) {
      return (
        <div className="panel-empty">
          <p>Add a query to get some data!</p>
        </div>
      );
    }

    return (
      <>
        {this.renderLoadingSpinner()}
        {this.props.children({
          timeSeries,
          loading,
        })}
      </>
    );
  }

  private renderLoadingSpinner(): JSX.Element {
    const { loading } = this.state;

    if (loading === LoadingState.Loading) {
      return (
        <div className="panel-loading">
          <i className="fa fa-spinner fa-spin" />
        </div>
      );
    }

    return null;
  }
}
