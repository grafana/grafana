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
  PanelData,
  DataRequestInfo,
} from '@grafana/ui';

interface RenderProps {
  data: PanelData;
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
  data: PanelData;
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
      data: {
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
        data: {
          state: LoadingState.Done,
          series: [],
        },
      });
      return;
    }

    this.setState({
      data: {
        ...this.state.data,
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
      const series = getProcessedSeriesData(resp.data);
      if (onDataResponse) {
        onDataResponse(series);
      }

      this.setState({
        isFirstLoad: false,
        data: {
          state: LoadingState.Done,
          series,
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
        data: {
          ...this.state.data,
          loading: LoadingState.Error,
        },
      });
    }
  };

  render() {
    const { queries } = this.props;
    const { isFirstLoad, data } = this.state;
    const { state } = data;

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
        {this.props.children({ data })}
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
