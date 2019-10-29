// Libraries
import $ from 'jquery';
import React, { PureComponent } from 'react';
import uniqBy from 'lodash/uniqBy';
// Types
import { TimeRange, GraphSeriesXY, TimeZone, DefaultTimeZone, KeyValue } from '@grafana/data';
import _ from 'lodash';
import { FlotPosition, FlotItem } from './types';
import { TooltipProps, TooltipContentProps } from '../Chart/Tooltip';
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
  // activeSeriesIndex?: number;
  // activeDatapointIndex?: number;
  activeItem?: FlotItem<GraphSeriesXY>;
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

  onPlotHover = (event: JQueryEventObject, pos: FlotPosition, item?: FlotItem<GraphSeriesXY>) => {
    this.setState({
      isTooltipVisible: true,
      allSeriesMode: !item,
      activeItem: item,
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
    const { pos, activeItem, isTooltipVisible } = this.state;
    const tooltips: React.ReactNode[] = [];

    if (!isTooltipVisible || !pos || series.length < 0) {
      return null;
    }

    // Find children that indicate tooltip to be rendered
    React.Children.forEach(children, c => {
      // @ts-ignore
      const childType = c && c.type && (c.type.displayName || c.type.name);

      if (childType === 'ChartTooltip') {
        tooltips.push(c);
      }
    });

    const tooltipElement = tooltips[0];

    // If no tooltip provided, skip rendering
    if (!tooltipElement) {
      return null;
    }

    // If mode is single series and user is not hovering over item, skip rendering
    if (!activeItem && tooltipOptions.mode === 'single') {
      return null;
    }

    const tooltipElementProps = (tooltipElement as React.ReactElement<TooltipProps>).props;

    // Check if tooltip needs to be rendered with custom tooltip component, otherwise default to GraphTooltip
    const tooltipContentRenderer = tooltipElementProps.tooltipComponent || GraphTooltip;

    const seriesIndex = activeItem ? activeItem.series.seriesIndex : 0;
    const rowIndex = activeItem ? activeItem.dataIndex : 0;

    // Indicates x-axis dimmension's active item
    // When hovering over an item - let's take it's dataIndex, otherwise let's assume flot position
    // based on witch tooltip needs to figure out correct datapoint display information about
    let activeDimmensions: KeyValue<[number, number]> = {
      // first- index of active field, second- index of field value or flots xaxis position
      xAxis: [seriesIndex, tooltipOptions.mode === 'single' ? rowIndex : pos.x],
    };

    if (activeItem) {
      // When hovering over a datapoint, we can now describe what't the "address" of it,
      // meaning dimmension's index and row index within dimmension's values
      activeDimmensions = {
        ...activeDimmensions,
        yAxis: [activeItem!.series.seriesIndex, activeItem!.dataIndex],
      };
    }

    const tooltipContentProps: TooltipContentProps = {
      dimmensions: {
        xAxis: series.map(s => s.timeDimmension),
        yAxis: series.map(s => s.valueDimmension),
      },
      activeDimmensions,
      pos,
      timeZone,
      mode: tooltipOptions.mode || 'single',
    };

    const tooltipContent = React.createElement(tooltipContentRenderer, { ...tooltipContentProps });

    return React.cloneElement<TooltipProps>(tooltipElement as React.ReactElement<TooltipProps>, {
      content: tooltipContent,
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
            this.setState({ isTooltipVisible: false });
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
