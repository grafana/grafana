import $ from 'jquery';
import React, { Component } from 'react';
import moment from 'moment';

import 'vendor/flot/jquery.flot';
import 'vendor/flot/jquery.flot.time';
import * as dateMath from 'app/core/utils/datemath';
import TimeSeries from 'app/core/time_series2';

import Legend from './Legend';

// Copied from graph.ts
function time_format(ticks, min, max) {
  if (min && max && ticks) {
    var range = max - min;
    var secPerTick = range / ticks / 1000;
    var oneDay = 86400000;
    var oneYear = 31536000000;

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
  // selection: {
  //   mode: 'x',
  //   color: '#666',
  // },
  // crosshair: {
  //   mode: 'x',
  // },
};

class Graph extends Component<any, any> {
  componentDidMount() {
    this.draw();
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.data !== this.props.data ||
      prevProps.options !== this.props.options ||
      prevProps.split !== this.props.split ||
      prevProps.height !== this.props.height
    ) {
      this.draw();
    }
  }

  draw() {
    const { data, options: userOptions } = this.props;
    if (!data) {
      return;
    }
    const series = data.map((ts: TimeSeries) => ({
      color: ts.color,
      label: ts.label,
      data: ts.getFlotPairs('null'),
    }));

    const $el = $(`#${this.props.id}`);
    const ticks = $el.width() / 100;
    let { from, to } = userOptions.range;
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
    const { data, height } = this.props;
    return (
      <div className="panel-container">
        <div id={this.props.id} className="explore-graph" style={{ height }} />
        <Legend data={data} />
      </div>
    );
  }
}

export default Graph;
