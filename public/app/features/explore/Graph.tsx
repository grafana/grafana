import $ from 'jquery';
import React, { PureComponent } from 'react';
import difference from 'lodash/difference';

import 'vendor/flot/jquery.flot';
import 'vendor/flot/jquery.flot.time';
import 'vendor/flot/jquery.flot.selection';
import 'vendor/flot/jquery.flot.stack';

import { TimeZone, AbsoluteTimeRange, GraphLegend, LegendItem, LegendDisplayMode } from '@grafana/ui';
import TimeSeries from 'app/core/time_series2';

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
  range: AbsoluteTimeRange;
  timeZone: TimeZone;
  split?: boolean;
  userOptions?: any;
  onChangeTime?: (range: AbsoluteTimeRange) => void;
  onToggleSeries?: (alias: string, hiddenSeries: string[]) => void;
}

interface GraphState {
  /**
   * Type parameter refers to the `alias` property of a `TimeSeries`.
   * Consequently, all series sharing the same alias will share visibility state.
   */
  hiddenSeries: string[];
  showAllTimeSeries: boolean;
}

export class Graph extends PureComponent<GraphProps, GraphState> {
  $el: any;
  dynamicOptions = null;

  state = {
    hiddenSeries: [],
    showAllTimeSeries: false,
  };

  getGraphData(): TimeSeries[] {
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
      prevState.hiddenSeries !== this.state.hiddenSeries
    ) {
      this.draw();
    }
  }

  componentWillUnmount() {
    this.$el.unbind('plotselected', this.onPlotSelected);
  }

  onPlotSelected = (event: JQueryEventObject, ranges) => {
    const { onChangeTime } = this.props;
    if (onChangeTime) {
      this.props.onChangeTime({
        from: ranges.xaxis.from,
        to: ranges.xaxis.to,
      });
    }
  };

  getDynamicOptions() {
    const { range, width, timeZone } = this.props;
    const ticks = (width || 0) / 100;
    const min = range.from;
    const max = range.to;
    return {
      xaxis: {
        mode: 'time',
        min: min,
        max: max,
        label: 'Datetime',
        ticks: ticks,
        timezone: timeZone,
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

  draw() {
    const { userOptions = {} } = this.props;
    const { hiddenSeries } = this.state;
    const data = this.getGraphData();

    const $el = $(`#${this.props.id}`);
    let series = [{ data: [[0, 0]] }];

    if (data && data.length > 0) {
      series = data
        .filter((ts: TimeSeries) => hiddenSeries.indexOf(ts.alias) === -1)
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

  getLegendItems = (): LegendItem[] => {
    const { hiddenSeries } = this.state;
    const data = this.getGraphData();

    return data.map(series => {
      return {
        label: series.alias,
        color: series.color,
        isVisible: hiddenSeries.indexOf(series.alias) === -1,
        yAxis: 1,
      };
    });
  };

  onSeriesToggle(label: string, event: React.MouseEvent<HTMLElement>) {
    // This implementation is more or less a copy of GraphPanel's logic.
    // TODO: we need to use Graph's panel controller or split it into smaller
    // controllers to remove code duplication. Right now we cant easily use that, since Explore
    // is not using SeriesData for graph yet

    const exclusive = event.ctrlKey || event.metaKey || event.shiftKey;

    this.setState((state, props) => {
      const { data, onToggleSeries } = props;
      let nextHiddenSeries: string[] = [];
      if (exclusive) {
        // Toggling series with key makes the series itself to toggle
        if (state.hiddenSeries.indexOf(label) > -1) {
          nextHiddenSeries = state.hiddenSeries.filter(series => series !== label);
        } else {
          nextHiddenSeries = state.hiddenSeries.concat([label]);
        }
      } else {
        // Toggling series with out key toggles all the series but the clicked one
        const allSeriesLabels = data.map(series => series.label);

        if (state.hiddenSeries.length + 1 === allSeriesLabels.length) {
          nextHiddenSeries = [];
        } else {
          nextHiddenSeries = difference(allSeriesLabels, [label]);
        }
      }

      if (onToggleSeries) {
        onToggleSeries(label, nextHiddenSeries);
      }

      return {
        hiddenSeries: nextHiddenSeries,
      };
    });
  }

  render() {
    const { height = 100, id = 'graph' } = this.props;
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

        <GraphLegend
          items={this.getLegendItems()}
          displayMode={LegendDisplayMode.List}
          placement="under"
          onLabelClick={(item, event) => {
            this.onSeriesToggle(item.label, event);
          }}
        />
      </>
    );
  }
}

export default Graph;
