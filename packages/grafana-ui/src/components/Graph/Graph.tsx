// Libraries
import $ from 'jquery';
import React, { PureComponent } from 'react';
import uniqBy from 'lodash/uniqBy';

// Types
import { TimeRange, GraphSeriesXY, AbsoluteTimeRange, TimeZone, DefaultTimeZone } from '@grafana/data';

export interface GraphProps {
  series: GraphSeriesXY[];
  timeRange: TimeRange; // NOTE: we should aim to make `time` a property of the axis, not force it for all graphs
  timeZone: TimeZone; // NOTE: we should aim to make `time` a property of the axis, not force it for all graphs
  showLines?: boolean;
  showPoints?: boolean;
  showBars?: boolean;
  width: number;
  height: number;
  isStacked?: boolean;
  lineWidth?: number;
  onSelectionChanged?: (range: AbsoluteTimeRange) => void;
}

export class Graph extends PureComponent<GraphProps> {
  static defaultProps = {
    showLines: true,
    showPoints: false,
    showBars: false,
    isStacked: false,
    lineWidth: 1,
  };

  element: HTMLElement | null = null;
  $element: any;

  componentDidUpdate() {
    this.draw();
  }

  componentDidMount() {
    this.draw();
    if (this.element) {
      this.$element = $(this.element);
      this.$element.bind('plotselected', this.onPlotSelected);
    }
  }

  componentWillUnmount() {
    this.$element.unbind('plotselected', this.onPlotSelected);
  }

  onPlotSelected = (event: JQueryEventObject, ranges: { xaxis: { from: number; to: number } }) => {
    const { onSelectionChanged } = this.props;
    if (onSelectionChanged) {
      onSelectionChanged({
        from: ranges.xaxis.from,
        to: ranges.xaxis.to,
      });
    }
  };

  draw() {
    if (this.element === null) {
      return;
    }

    const { width, series, timeRange, showLines, showBars, showPoints, isStacked, lineWidth, timeZone } = this.props;

    if (!width) {
      return;
    }

    const ticks = width / 100;
    const min = timeRange.from.valueOf();
    const max = timeRange.to.valueOf();
    const yaxes = uniqBy(
      series.map(s => {
        const index = s.yAxis ? s.yAxis.index : 1;
        const min = s.yAxis && !isNaN(s.yAxis.min as number) ? s.yAxis.min : null;
        const tickDecimals = s.yAxis && !isNaN(s.yAxis.tickDecimals as number) ? s.yAxis.tickDecimals : null;

        return {
          show: true,
          index,
          position: index === 1 ? 'left' : 'right',
          min,
          tickDecimals,
        };
      }),
      yAxisConfig => yAxisConfig.index
    );
    const flotOptions: any = {
      legend: {
        show: false,
      },
      series: {
        stack: isStacked,
        lines: {
          show: showLines,
          linewidth: lineWidth,
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
          lineWidth: lineWidth,
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
        timezone: timeZone ? timeZone : DefaultTimeZone,
      },
      yaxes,
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
    };

    try {
      $.plot(this.element, series, flotOptions);
    } catch (err) {
      console.log('Graph rendering error', err, flotOptions, series);
      throw new Error('Error rendering panel');
    }
  }

  render() {
    const { height } = this.props;
    return (
      <div className="graph-panel">
        <div className="graph-panel__chart" ref={e => (this.element = e)} style={{ height }} />
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
