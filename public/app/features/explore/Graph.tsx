import $ from 'jquery';
import React, { PureComponent } from 'react';
import moment from 'moment';
import { withSize } from 'react-sizeme';

import 'vendor/flot/jquery.flot';
import 'vendor/flot/jquery.flot.time';
import 'vendor/flot/jquery.flot.selection';
import 'vendor/flot/jquery.flot.stack';

import { RawTimeRange } from 'app/types/series';
import * as dateMath from 'app/core/utils/datemath';
import TimeSeries from 'app/core/time_series2';

import Legend from './Legend';

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
  height?: string; // e.g., '200px'
  id?: string;
  range: RawTimeRange;
  split?: boolean;
  size?: { width: number; height: number };
  userOptions?: any;
  onChangeTime?: (range: RawTimeRange) => void;
}

interface GraphState {
  showAllTimeSeries: boolean;
}

export class Graph extends PureComponent<GraphProps, GraphState> {
  $el: any;

  state = {
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

  componentDidUpdate(prevProps: GraphProps) {
    if (
      prevProps.data !== this.props.data ||
      prevProps.range !== this.props.range ||
      prevProps.split !== this.props.split ||
      prevProps.height !== this.props.height ||
      (prevProps.size && prevProps.size.width !== this.props.size.width)
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

  onShowAllTimeSeries = () => {
    this.setState(
      {
        showAllTimeSeries: true,
      },
      this.draw
    );
  };

  draw() {
    const { range, size, userOptions = {} } = this.props;
    const data = this.getGraphData();

    const $el = $(`#${this.props.id}`);
    let series = [{ data: [[0, 0]] }];

    if (data && data.length > 0) {
      series = data.map((ts: TimeSeries) => ({
        color: ts.color,
        label: ts.label,
        data: ts.getFlotPairs('null'),
      }));
    }

    const ticks = (size.width || 0) / 100;
    let { from, to } = range;
    if (!moment.isMoment(from)) {
      from = dateMath.parse(from, false);
    }
    if (!moment.isMoment(to)) {
      to = dateMath.parse(to, true);
    }
    const min = from.valueOf();
    const max = to.valueOf();
    const dynamicOptions = {
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
    const options = {
      ...FLOT_OPTIONS,
      ...dynamicOptions,
      ...userOptions,
    };
    $.plot($el, series, options);
  }

  render() {
    const { height = '100px', id = 'graph' } = this.props;
    const data = this.getGraphData();

    return (
      <>
        {this.props.data &&
          this.props.data.length > MAX_NUMBER_OF_TIME_SERIES &&
          !this.state.showAllTimeSeries && (
            <div className="time-series-disclaimer">
              <i className="fa fa-fw fa-warning disclaimer-icon" />
              {`Showing only ${MAX_NUMBER_OF_TIME_SERIES} time series. `}
              <span className="show-all-time-series" onClick={this.onShowAllTimeSeries}>{`Show all ${
                this.props.data.length
              }`}</span>
            </div>
          )}
        <div id={id} className="explore-graph" style={{ height }} />
        <Legend data={data} />
      </>
    );
  }
}

export default withSize()(Graph);
