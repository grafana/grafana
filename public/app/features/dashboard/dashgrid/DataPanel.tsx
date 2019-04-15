// Library
import React, { Component } from 'react';

// Services
import { DatasourceSrv, getDatasourceSrv } from 'app/features/plugins/datasource_srv';
// Utils
import kbn from 'app/core/utils/kbn';
// Types
import {
  DataQueryError,
  LoadingState,
  SeriesData,
  TimeRange,
  ScopedVars,
  toSeriesData,
  guessFieldTypes,
  DataQuery,
  DataRequestInfo,
  QueryResponseData,
} from '@grafana/ui';

interface RenderProps {
  data?: QueryResponseData;
}

export interface Props {
  datasource: string | null;
  queries: DataQuery[];
  panelId: number;
  dashboardId?: number;
  isVisible?: boolean;
  timeRange?: TimeRange;
  widthPixels: number;
  refreshCounter: number;
  minInterval?: string;
  maxDataPoints?: number;
  scopedVars?: ScopedVars;
  children: (r: RenderProps) => JSX.Element;
  onDataResponse?: (data?: SeriesData[]) => void;
  onError: (message: string, error: DataQueryError) => void;
}

export interface State {
  isFirstLoad: boolean;
  response: QueryResponseData;
}

/**
 * All panels will be passed tables that have our best guess at colum type set
 *
 * This is also used by PanelChrome for snapshot support
 */
export function getProcessedSeriesData(results?: any[]): SeriesData[] {
  if (!results) {
    return [];
  }

  const series: SeriesData[] = [];
  for (const r of results) {
    if (r) {
      series.push(guessFieldTypes(toSeriesData(r)));
    }
  }
  return series;
}

export class DataPanel extends Component<Props, State> {
  static defaultProps = {
    isVisible: true,
    dashboardId: 1,
  };

  dataSourceSrv: DatasourceSrv = getDatasourceSrv();
  isUnmounted = false;

  constructor(props: Props) {
    super(props);

    this.state = {
      isFirstLoad: true,
      response: {
        state: LoadingState.NotStarted,
        series: [],
      },
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
      scopedVars,
      onDataResponse,
      onError,
    } = this.props;

    if (!isVisible) {
      return;
    }

    if (!queries.length) {
      this.setState({
        response: {
          state: LoadingState.Done,
          series: [],
        },
      });
      return;
    }

    this.setState({
      response: {
        ...this.state.response,
        loading: LoadingState.Loading,
      },
    });

    try {
      const ds = await this.dataSourceSrv.get(datasource, scopedVars);

      const minInterval = this.props.minInterval || ds.interval;
      const intervalRes = kbn.calculateInterval(timeRange, widthPixels, minInterval);

      // make shallow copy of scoped vars,
      // and add built in variables interval and interval_ms
      const scopedVarsWithInterval = Object.assign({}, scopedVars, {
        __interval: { text: intervalRes.interval, value: intervalRes.interval },
        __interval_ms: { text: intervalRes.intervalMs.toString(), value: intervalRes.intervalMs },
      });

      const request: DataRequestInfo = {
        timezone: 'browser',
        panelId: panelId,
        dashboardId: dashboardId,
        range: timeRange,
        rangeRaw: timeRange.raw,
        interval: intervalRes.interval,
        intervalMs: intervalRes.intervalMs,
        targets: queries,
        maxDataPoints: maxDataPoints || widthPixels,
        scopedVars: scopedVarsWithInterval,
        cacheTimeout: null,
        startTime: Date.now(),
      };

      const resp = await ds.query(request);
      request.endTime = Date.now();

      if (this.isUnmounted) {
        return;
      }

      // Make sure the data is SeriesData[]
      const data = getProcessedSeriesData(resp.data);
      if (onDataResponse) {
        onDataResponse(data);
      }

      this.setState({
        isFirstLoad: false,
        response: {
          state: LoadingState.Done,
          series: data,
          request,
        },
      });
    } catch (err) {
      console.log('DataPanel error', err);

      let message = 'Query error';

      if (err.message) {
        message = err.message;
      } else if (err.data && err.data.message) {
        message = err.data.message;
      } else if (err.data && err.data.error) {
        message = err.data.error;
      } else if (err.status) {
        message = `Query error: ${err.status} ${err.statusText}`;
      }

      onError(message, err);

      this.setState({
        isFirstLoad: false,
        response: {
          ...this.state.response,
          loading: LoadingState.Error,
        },
      });
    }
  };

  render() {
    const { queries } = this.props;
    const { isFirstLoad, response } = this.state;
    const { state } = response;

    // do not render component until we have first data
    if (isFirstLoad && (state === LoadingState.Loading || state === LoadingState.NotStarted)) {
      return this.renderLoadingState();
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
        {state === LoadingState.Loading && this.renderLoadingState()}
        {this.props.children({ data: response })}
      </>
    );
  }

  private renderLoadingState(): JSX.Element {
    return (
      <div className="panel-loading">
        <i className="fa fa-spinner fa-spin" />
      </div>
    );
  }
}
