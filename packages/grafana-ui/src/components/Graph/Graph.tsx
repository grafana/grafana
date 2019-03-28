// Libraries
import $ from 'jquery';
import React, { PureComponent } from 'react';

// Types
import { TimeRange, GraphSeriesXY } from '../../types';

interface GraphProps {
  series: GraphSeriesXY[];
  timeRange: TimeRange; // NOTE: we should aim to make `time` a property of the axis, not force it for all graphs
  showLines?: boolean;
  showPoints?: boolean;
  showBars?: boolean;
  width: number;
  height: number;
}

export class Graph extends PureComponent<GraphProps> {
  static defaultProps = {
    showLines: true,
    showPoints: false,
    showBars: false,
  };

  element: HTMLElement | null = null;

  componentDidUpdate() {
    this.draw();
  }

  componentDidMount() {
    this.draw();
  }

  draw() {
    if (this.element === null) {
      return;
    }

    const { width, series, timeRange, showLines, showBars, showPoints } = this.props;

    if (!width) {
      return;
    }

    const ticks = width / 100;
    const min = timeRange.from.valueOf();
    const max = timeRange.to.valueOf();

    const flotOptions = {
      legend: {
        show: false,
      },
      series: {
        lines: {
          show: showLines,
          linewidth: 1,
          zero: false,
        },
        points: {
          show: showPoints,
          fill: 1,
          fillColor: false,
          radius: 2,
        },
        bars: {
          show: showBars,
          fill: 1,
          barWidth: 1,
          zero: false,
          lineWidth: 0,
        },
        shadowSize: 0,
      },
      xaxis: {
        mode: 'time',
        min: min,
        max: max,
        label: 'Datetime',
        ticks: ticks,
        timeformat: timeFormat(ticks, min, max),
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
    };

    try {
      console.log('Graph render');
      $.plot(this.element, series, flotOptions);
    } catch (err) {
      console.log('Graph rendering error', err, flotOptions, series);
      throw new Error('Error rendering panel');
    }
  }

  render() {
    return (
      <div className="graph-panel">
        <div className="graph-panel__chart" ref={e => (this.element = e)} />
      </div>
    );
  }
}

// Copied from graph.ts
function timeFormat(ticks: number, min: number, max: number): string {
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

export default Graph;
