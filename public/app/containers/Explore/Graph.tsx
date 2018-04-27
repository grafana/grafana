import $ from 'jquery';
import React, { Component } from 'react';

import TimeSeries from 'app/core/time_series2';

import 'vendor/flot/jquery.flot';
import 'vendor/flot/jquery.flot.time';

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
      label: ts.label,
      data: ts.getFlotPairs('null'),
    }));

    const $el = $(`#${this.props.id}`);
    const ticks = $el.width() / 100;
    const min = userOptions.range.from.valueOf();
    const max = userOptions.range.to.valueOf();
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
    const style = {
      height: this.props.height || '400px',
      width: this.props.width || '100%',
    };

    return <div id={this.props.id} style={style} />;
  }
}

export default Graph;
