// Library
import React, { Component } from 'react';

import moment from 'moment';
import * as dateMath from 'app/core/utils/datemath';

// Services
import { DatasourceSrv, getDatasourceSrv } from 'app/features/plugins/datasource_srv';
// Utils
import kbn from 'app/core/utils/kbn';
// Types
import {
  DataQueryOptions,
  DataQueryResponse,
  DataQueryError,
  LoadingState,
  SeriesData,
  TimeRange,
  ScopedVars,
  toSeriesData,
  guessFieldTypes,
} from '@grafana/ui';

import { StreamObserver } from './StreamObserver';

interface RenderProps {
  loading: LoadingState;
  data: SeriesData[];
  timeRange?: TimeRange;
}

export interface Props {
  datasource: string | null;
  queries: any[];
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
  onDataResponse?: (data: SeriesData[]) => void;
  onError: (message: string, error: DataQueryError) => void;
}

export interface State {
  isFirstLoad: boolean;
  loading: LoadingState;
  response: DataQueryResponse;
  data?: SeriesData[];
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

  streams = new Map<string, StreamObserver>();
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

    // Remove all listeners
    for (const stream of this.streams.values()) {
      stream.unsubscribe();
    }
    this.streams.clear();
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

  /**
   * Replace the existing series with the streamed result
   */
  onStreamSeriesUpdate = (series: SeriesData) => {
    const { data } = this.state;
    let found = false;

    console.log('UPDATE', this.state, series, data);
    this.setState({
      loading: LoadingState.Done,
      data: data.map(d => {
        if (d.refId === series.refId) {
          found = true;
          return series;
        }
        return d;
      }),
      isFirstLoad: false,
    });
    return found;
  };

  processResponseData(resp: DataQueryResponse): SeriesData[] {
    const { streams } = this;

    const data = getProcessedSeriesData(resp.data);

    const streaming = new Set();
    for (const series of data) {
      const { stream, refId } = series;
      if (stream) {
        if (!refId) {
          console.warn('Stream data is missing refId', series);
          continue;
        }
        streaming.add(refId);
        const existing = streams.get(refId);
        if (existing) {
          if (existing.isStreaming(series)) {
            continue;
          }
          existing.unsubscribe(); // The stream changed
        }
        streams.set(refId, new StreamObserver(series, this.onStreamSeriesUpdate));
      }
    }

    // Clear any open streams that did not come back
    for (const ref of streams.keys()) {
      if (!streaming.has(ref)) {
        streams.get(ref).unsubscribe();
        streams.delete(ref);
      }
    }

    return data;
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
      this.setState({ loading: LoadingState.Done });
      return;
    }

    this.setState({ loading: LoadingState.Loading });

    try {
      const ds = await this.dataSourceSrv.get(datasource, scopedVars);

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
        scopedVars: scopedVars || {},
        cacheTimeout: null,
      };

      const resp = await ds.query(queryOptions);

      if (this.isUnmounted) {
        return;
      }

      const data = this.processResponseData(resp);

      if (onDataResponse) {
        onDataResponse(data);
      }

      this.setState({
        loading: LoadingState.Done,
        response: resp,
        data,
        isFirstLoad: false,
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
      this.setState({ isFirstLoad: false, loading: LoadingState.Error });
    }
  };

  getTimeRange(): TimeRange {
    const { timeRange } = this.props;
    const { raw } = timeRange;

    if (moment.isMoment(raw.to) || raw.to.indexOf('now') < 0) {
      return timeRange;
    }

    const timezone = 'utc'; //  ??? where can we get it
    return {
      from: dateMath.parse(raw.from, false, timezone),
      to: dateMath.parse(raw.to, true, timezone),
      raw: raw,
    };
  }

  render() {
    const { queries } = this.props;
    const { loading, isFirstLoad, data } = this.state;

    // do not render component until we have first data
    if (isFirstLoad && (loading === LoadingState.Loading || loading === LoadingState.NotStarted)) {
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
        {loading === LoadingState.Loading && this.renderLoadingState()}
        {this.props.children({ loading, timeRange: this.getTimeRange(), data })}
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
