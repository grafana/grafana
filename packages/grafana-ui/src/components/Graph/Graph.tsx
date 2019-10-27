// Libraries
import $ from 'jquery';
import React, { PureComponent } from 'react';
import uniqBy from 'lodash/uniqBy';
// Types
import { TimeRange, GraphSeriesXY, TimeZone, DefaultTimeZone } from '@grafana/data';
import _ from 'lodash';
import { FlotPosition, FlotItem } from './types';
import { TooltipProps } from '../Chart/Tooltip';
import { GraphTooltip, GraphTooltipOptions } from './GraphTooltip';

export interface GraphProps {
  children?: JSX.Element | JSX.Element[];
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
  onHorizontalRegionSelected?: (from: number, to: number) => void;
  tooltipOptions: GraphTooltipOptions;
}

interface GraphState {
  pos?: FlotPosition;
  isTooltipVisible: boolean;
  activeSeriesIndex?: number;
  activeDatapointIndex?: number;
  allSeriesMode?: boolean;
}

export class Graph extends PureComponent<GraphProps, GraphState> {
  static defaultProps = {
    showLines: true,
    showPoints: false,
    showBars: false,
    isStacked: false,
    lineWidth: 1,
  };

  state: GraphState = {
    isTooltipVisible: true,
  };

  element: HTMLElement | null = null;
  $element: any;

  componentDidUpdate(prevProps: GraphProps, prevState: GraphState) {
    if (prevProps !== this.props) {
      this.draw();
    }
  }

  componentDidMount() {
    this.draw();
    if (this.element) {
      this.$element = $(this.element);
      this.$element.bind('plotselected', this.onPlotSelected);
      this.$element.bind('plothover', this.onPlotHover);
    }
  }

  componentWillUnmount() {
    this.$element.unbind('plotselected', this.onPlotSelected);
  }

  onPlotSelected = (event: JQueryEventObject, ranges: { xaxis: { from: number; to: number } }) => {
    const { onHorizontalRegionSelected } = this.props;
    if (onHorizontalRegionSelected) {
      onHorizontalRegionSelected(ranges.xaxis.from, ranges.xaxis.to);
    }
  };

  onPlotHover = (event: JQueryEventObject, pos: FlotPosition, item?: FlotItem) => {
    this.setState({
      isTooltipVisible: true,
      allSeriesMode: !item,
      activeSeriesIndex: item ? item.seriesIndex : undefined,
      activeDatapointIndex: item ? item.dataIndex : undefined,
      pos,
    });
  };

  getYAxes(series: GraphSeriesXY[]) {
    if (series.length === 0) {
      return [{ show: true, min: -1, max: 1 }];
    }
    return uniqBy(
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
  }

  renderTooltip = () => {
    const { children, series, timeZone, tooltipOptions } = this.props;
    const { pos, activeSeriesIndex, activeDatapointIndex, isTooltipVisible } = this.state;
    const tooltips: React.ReactNode[] = [];

    if (!isTooltipVisible || !pos) {
      return null;
    }
    //  Extract to an util
    React.Children.forEach(children, c => {
      // @ts-ignore
      const childType = c && c.type && (c.type.displayName || c.type.name);

      if (childType === 'ChartTooltip') {
        tooltips.push(c);
      }
    });

    const tooltipElement = tooltips[0];

    if (!tooltipElement) {
      return null;
    }

    return React.cloneElement<TooltipProps>(tooltipElement as React.ReactElement<TooltipProps>, {
      content: (
        <GraphTooltip
          series={series}
          seriesIndex={activeSeriesIndex}
          datapointIndex={activeDatapointIndex}
          pos={pos}
          mode={tooltipOptions.mode}
          timeZone={timeZone}
        />
      ),
      position: { x: pos.pageX, y: pos.pageY },
      offset: { x: 10, y: 10 },
    });
  };

  draw() {
    if (this.element === null) {
      return;
    }

    const {
      width,
      series,
      timeRange,
      showLines,
      showBars,
      showPoints,
      isStacked,
      lineWidth,
      timeZone,
      onHorizontalRegionSelected,
    } = this.props;

    if (!width) {
      return;
    }

    const ticks = width / 100;
    const min = timeRange.from.valueOf();
    const max = timeRange.to.valueOf();
    const yaxes = this.getYAxes(series);

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
        show: true,
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
        hoverable: true,
        clickable: true,
        color: '#a1a1a1',
        margin: { left: 0, right: 0 },
        labelMarginX: 0,
        mouseActiveRadius: 30,
      },
      selection: {
        mode: onHorizontalRegionSelected ? 'x' : null,
        color: '#666',
      },
      crosshair: {
        mode: 'x',
      },
    };

    // console.logg
    try {
      $.plot(this.element, series, flotOptions);
    } catch (err) {
      console.log('Graph rendering error', err, flotOptions, series);
      throw new Error('Error rendering panel');
    }
  }

  render() {
    const { height, series } = this.props;
    const noDataToBeDisplayed = series.length === 0;
    return (
      <div className="graph-panel">
        <div
          className="graph-panel__chart"
          ref={e => (this.element = e)}
          style={{ height }}
          onMouseLeave={() => {
            this.setState({ isTooltipVisible: true });
          }}
        />

        {noDataToBeDisplayed && <div className="datapoints-warning">No data</div>}
        {this.renderTooltip()}
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
