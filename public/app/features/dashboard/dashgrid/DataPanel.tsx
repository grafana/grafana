// Library
import React, { Component } from 'react';
import { Tooltip } from '@grafana/ui';

import ErrorBoundary from 'app/core/components/ErrorBoundary/ErrorBoundary';
// Services
import { DatasourceSrv, getDatasourceSrv } from 'app/features/plugins/datasource_srv';
// Utils
import kbn from 'app/core/utils/kbn';
// Types
import {
  DataQueryOptions,
  DataQueryResponse,
  LoadingState,
  PanelData,
  TableData,
  TimeRange,
  TimeSeries,
} from '@grafana/ui';

const DEFAULT_PLUGIN_ERROR = 'Error in plugin';

interface RenderProps {
  loading: LoadingState;
  panelData: PanelData;
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
  onDataResponse?: (data: DataQueryResponse) => void;
}

export interface State {
  isFirstLoad: boolean;
  loading: LoadingState;
  errorMessage: string;
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
      errorMessage: '',
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
    const {
      isVisible,
      queries,
      datasource,
      panelId,
      dashboardId,
      timeRange,
      widthPixels,
      maxDataPoints,
      onDataResponse,
    } = this.props;

    if (!isVisible) {
      return;
    }

    if (!queries.length) {
      this.setState({ loading: LoadingState.Done });
      return;
    }

    this.setState({ loading: LoadingState.Loading, errorMessage: '' });

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

      const resp = await ds.query(queryOptions);

      if (this.isUnmounted) {
        return;
      }

      if (onDataResponse) {
        onDataResponse(resp);
      }

      this.setState({
        loading: LoadingState.Done,
        response: resp,
        isFirstLoad: false,
      });
    } catch (err) {
      console.log('Loading error', err);
      this.onError('Request Error');
    }
  };

  onError = (errorMessage: string) => {
    if (this.state.loading !== LoadingState.Error || this.state.errorMessage !== errorMessage) {
      this.setState({
        loading: LoadingState.Error,
        isFirstLoad: false,
        errorMessage: errorMessage,
      });
    }
  };

  getPanelData = () => {
    const { response } = this.state;

    if (response.data.length > 0 && (response.data[0] as TableData).type === 'table') {
      return {
        tableData: response.data[0] as TableData,
        timeSeries: null,
      };
    }

    return {
      timeSeries: response.data as TimeSeries[],
      tableData: null,
    };
  };

  render() {
    const { queries } = this.props;
    const { loading, isFirstLoad } = this.state;

    const panelData = this.getPanelData();

    if (isFirstLoad && loading === LoadingState.Loading) {
      return this.renderLoadingStates();
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
        {this.renderLoadingStates()}
        <ErrorBoundary>
          {({ error, errorInfo }) => {
            if (errorInfo) {
              this.onError(error.message || DEFAULT_PLUGIN_ERROR);
              return null;
            }
            return (
              <>
                {this.props.children({
                  loading,
                  panelData,
                })}
              </>
            );
          }}
        </ErrorBoundary>
      </>
    );
  }

  private renderLoadingStates(): JSX.Element {
    const { loading, errorMessage } = this.state;
    if (loading === LoadingState.Loading) {
      return (
        <div className="panel-loading">
          <i className="fa fa-spinner fa-spin" />
        </div>
      );
    } else if (loading === LoadingState.Error) {
      return (
        <Tooltip content={errorMessage} placement="bottom-start" theme="error">
          <div className="panel-info-corner panel-info-corner--error">
            <i className="fa" />
            <span className="panel-info-corner-inner" />
          </div>
        </Tooltip>
      );
    }

    return null;
  }
}
