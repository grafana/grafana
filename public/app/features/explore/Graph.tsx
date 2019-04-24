import $ from 'jquery';
import React, { PureComponent } from 'react';
import moment from 'moment';

import 'vendor/flot/jquery.flot';
import 'vendor/flot/jquery.flot.time';
import 'vendor/flot/jquery.flot.selection';
import 'vendor/flot/jquery.flot.stack';

import { RawTimeRange } from '@grafana/ui';
import * as dateMath from 'app/core/utils/datemath';
import TimeSeries from 'app/core/time_series2';

import Legend from './Legend';
import { equal, intersect } from './utils/set';

const MAX_NUMBER_OF_TIME_SERIES = 20;

// Copied from graph.ts
function time_format(ticks, min, max) {
  if (min && max && ticks) {
    const range = max - min;
    const secPerTick = range / ticks / 1000;
    const oneDay = 86400000;
    const oneYear = 31536000000;

    if (secPerTick <= 45) {
      return '%H:%M:%S';
    }
    if (secPerTick <= 7200 || range <= oneDay) {
      return '%H:%M';
    }
    if (secPerTick <= 80000) {
      return '%m/%d %H:%M';
    }
    if (secPerTick <= 2419200 || range <= oneYear) {
      return '%m/%d';
    }
    return '%Y-%m';
  }

  return '%H:%M';
}

const FLOT_OPTIONS = {
  legend: {
    show: false,
  },
  series: {
    lines: {
      linewidth: 1,
      zero: false,
    },
    shadowSize: 0,
  },
  grid: {
    minBorderMargin: 0,
    markings: [],
    backgroundColor: null,
    borderWidth: 0,
    // hoverable: true,
    clickable: true,
    color: '#a1a1a1',
    margin: { left: 0, right: 0 },
    labelMarginX: 0,
  },
  selection: {
    mode: 'x',
    color: '#666',
  },
  // crosshair: {
  //   mode: 'x',
  // },
};

interface GraphProps {
  data: any[];
  height?: number;
  width?: number;
  id?: string;
  range: RawTimeRange;
  split?: boolean;
  userOptions?: any;
  onChangeTime?: (range: RawTimeRange) => void;
  onToggleSeries?: (alias: string, hiddenSeries: Set<string>) => void;
}

interface GraphState {
  /**
   * Type parameter refers to the `alias` property of a `TimeSeries`.
   * Consequently, all series sharing the same alias will share visibility state.
   */
  hiddenSeries: Set<string>;
  showAllTimeSeries: boolean;
}

export class Graph extends PureComponent<GraphProps, GraphState> {
  $el: any;
  dynamicOptions = null;

  state = {
    hiddenSeries: new Set(),
    showAllTimeSeries: false,
  };

  getGraphData() {
    const { data } = this.props;

    return this.state.showAllTimeSeries ? data : data.slice(0, MAX_NUMBER_OF_TIME_SERIES);
  }

  componentDidMount() {
    this.draw();
    this.$el = $(`#${this.props.id}`);
    this.$el.bind('plotselected', this.onPlotSelected);
  }

  componentDidUpdate(prevProps: GraphProps, prevState: GraphState) {
    if (
      prevProps.data !== this.props.data ||
      prevProps.range !== this.props.range ||
      prevProps.split !== this.props.split ||
      prevProps.height !== this.props.height ||
      prevProps.width !== this.props.width ||
      !equal(prevState.hiddenSeries, this.state.hiddenSeries)
    ) {
      this.draw();
    }
  }

  componentWillUnmount() {
    this.$el.unbind('plotselected', this.onPlotSelected);
  }

  onPlotSelected = (event, ranges) => {
    if (this.props.onChangeTime) {
      const range = {
        from: moment(ranges.xaxis.from),
        to: moment(ranges.xaxis.to),
      };
      this.props.onChangeTime(range);
    }
  };

  getDynamicOptions() {
    const { range, width } = this.props;
    const ticks = (width || 0) / 100;
    let { from, to } = range;
    if (!moment.isMoment(from)) {
      from = dateMath.parse(from, false);
    }
    if (!moment.isMoment(to)) {
      to = dateMath.parse(to, true);
    }
    const min = from.valueOf();
    const max = to.valueOf();
    return {
      xaxis: {
        mode: 'time',
        min: min,
        max: max,
        label: 'Datetime',
        ticks: ticks,
        timezone: 'browser',
        timeformat: time_format(ticks, min, max),
      },
    };
  }

  onShowAllTimeSeries = () => {
    this.setState(
      {
        showAllTimeSeries: true,
      },
      this.draw
    );
  };

  onToggleSeries = (series: TimeSeries, exclusive: boolean) => {
    this.setState((state, props) => {
      const { data, onToggleSeries } = props;
      const { hiddenSeries } = state;

      // Deduplicate series as visibility tracks the alias property
      const oneSeriesVisible = hiddenSeries.size === new Set(data.map(d => d.alias)).size - 1;

      let nextHiddenSeries = new Set();
      if (exclusive) {
        if (hiddenSeries.has(series.alias) || !oneSeriesVisible) {
          nextHiddenSeries = new Set(data.filter(d => d.alias !== series.alias).map(d => d.alias));
        }
      } else {
        // Prune hidden series no longer part of those available from the most recent query
        const availableSeries = new Set(data.map(d => d.alias));
        nextHiddenSeries = intersect(new Set(hiddenSeries), availableSeries);
        if (nextHiddenSeries.has(series.alias)) {
          nextHiddenSeries.delete(series.alias);
        } else {
          nextHiddenSeries.add(series.alias);
        }
      }
      if (onToggleSeries) {
        onToggleSeries(series.alias, nextHiddenSeries);
      }
      return {
        hiddenSeries: nextHiddenSeries,
      };
    }, this.draw);
  };

  draw() {
    const { userOptions = {} } = this.props;
    const { hiddenSeries } = this.state;
    const data = this.getGraphData();

    const $el = $(`#${this.props.id}`);
    let series = [{ data: [[0, 0]] }];

    if (data && data.length > 0) {
      series = data
        .filter((ts: TimeSeries) => !hiddenSeries.has(ts.alias))
        .map((ts: TimeSeries) => ({
          color: ts.color,
          label: ts.label,
          data: ts.getFlotPairs('null'),
        }));
    }

    this.dynamicOptions = this.getDynamicOptions();

    const options = {
      ...FLOT_OPTIONS,
      ...this.dynamicOptions,
      ...userOptions,
    };

    $.plot($el, series, options);
  }

  render() {
    const { height = 100, id = 'graph' } = this.props;
    const { hiddenSeries } = this.state;
    const data = this.getGraphData();

    return (
      <>
        {this.props.data && this.props.data.length > MAX_NUMBER_OF_TIME_SERIES && !this.state.showAllTimeSeries && (
          <div className="time-series-disclaimer">
            <i className="fa fa-fw fa-warning disclaimer-icon" />
            {`Showing only ${MAX_NUMBER_OF_TIME_SERIES} time series. `}
            <span className="show-all-time-series" onClick={this.onShowAllTimeSeries}>{`Show all ${
              this.props.data.length
            }`}</span>
          </div>
        )}
        <div id={id} className="explore-graph" style={{ height }} />
        <Legend data={data} hiddenSeries={hiddenSeries} onToggleSeries={this.onToggleSeries} />
      </>
    );
  }
}

export default Graph;
