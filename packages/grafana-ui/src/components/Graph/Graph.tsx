// Libraries
import $ from 'jquery';
import React, { PureComponent } from 'react';
import uniqBy from 'lodash/uniqBy';
// Types
import {
  TimeRange,
  GraphSeriesXY,
  TimeZone,
  DefaultTimeZone,
  createDimension,
  DateTimeInput,
  dateTime,
} from '@grafana/data';
import _ from 'lodash';
import { FlotPosition, FlotItem } from './types';
import { TooltipProps, TooltipContentProps, ActiveDimensions, Tooltip } from '../Chart/Tooltip';
import { GraphTooltip } from './GraphTooltip/GraphTooltip';
import { GraphContextMenu, GraphContextMenuProps, ContextDimensions } from './GraphContextMenu';
import { GraphDimensions } from './GraphTooltip/types';

export interface GraphProps {
  children?: JSX.Element | JSX.Element[];
  series: GraphSeriesXY[];
  timeRange: TimeRange; // NOTE: we should aim to make `time` a property of the axis, not force it for all graphs
  timeZone?: TimeZone; // NOTE: we should aim to make `time` a property of the axis, not force it for all graphs
  showLines?: boolean;
  showPoints?: boolean;
  showBars?: boolean;
  width: number;
  height: number;
  isStacked?: boolean;
  lineWidth?: number;
  onHorizontalRegionSelected?: (from: number, to: number) => void;
}

interface GraphState {
  pos?: FlotPosition;
  contextPos?: FlotPosition;
  isTooltipVisible: boolean;
  isContextVisible: boolean;
  activeItem?: FlotItem<GraphSeriesXY>;
  contextItem?: FlotItem<GraphSeriesXY>;
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
    isTooltipVisible: false,
    isContextVisible: false,
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
      this.$element.bind('plotclick', this.onPlotClick);
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
      activeItem: item,
      pos,
    });
  };

  onPlotClick = (event: JQueryEventObject, contextPos: FlotPosition, item?: FlotItem<GraphSeriesXY>) => {
    this.setState({
      isContextVisible: true,
      isTooltipVisible: false,
      contextItem: item,
      contextPos,
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
    const { children, series } = this.props;
    const { pos, activeItem, isTooltipVisible } = this.state;
    let tooltipElement: React.ReactElement<TooltipProps> | null = null;

    if (!isTooltipVisible || !pos || series.length === 0) {
      return null;
    }

    // Find children that indicate tooltip to be rendered
    React.Children.forEach(children, c => {
      // We have already found tooltip
      if (tooltipElement) {
        return;
      }
      // @ts-ignore
      const childType = c && c.type && (c.type.displayName || c.type.name);

      if (childType === Tooltip.displayName) {
        tooltipElement = c as React.ReactElement<TooltipProps>;
      }
    });
    // If no tooltip provided, skip rendering
    if (!tooltipElement) {
      return null;
    }
    const tooltipElementProps = (tooltipElement as React.ReactElement<TooltipProps>).props;

    const tooltipMode = tooltipElementProps.mode || 'single';

    // If mode is single series and user is not hovering over item, skip rendering
    if (!activeItem && tooltipMode === 'single') {
      return null;
    }

    // Check if tooltip needs to be rendered with custom tooltip component, otherwise default to GraphTooltip
    const tooltipContentRenderer = tooltipElementProps.tooltipComponent || GraphTooltip;
    // Indicates column(field) index in y-axis dimension
    const seriesIndex = activeItem ? activeItem.series.seriesIndex : 0;
    // Indicates row index in active field values
    const rowIndex = activeItem ? activeItem.dataIndex : undefined;

    const activeDimensions: ActiveDimensions<GraphDimensions> = {
      // Described x-axis active item
      // When hovering over an item - let's take it's dataIndex, otherwise undefined
      // Tooltip itself needs to figure out correct datapoint display information based on pos passed to it
      xAxis: [seriesIndex, rowIndex],
      // Describes y-axis active item
      yAxis: activeItem ? [activeItem.series.seriesIndex, activeItem.dataIndex] : null,
    };

    const tooltipContentProps: TooltipContentProps<GraphDimensions> = {
      dimensions: {
        // time/value dimension columns are index-aligned - see getGraphSeriesModel
        xAxis: createDimension(
          'xAxis',
          series.map(s => s.timeField)
        ),
        yAxis: createDimension(
          'yAxis',
          series.map(s => s.valueField)
        ),
      },
      activeDimensions,
      pos,
      mode: tooltipElementProps.mode || 'single',
    };

    const tooltipContent = React.createElement(tooltipContentRenderer, { ...tooltipContentProps });

    return React.cloneElement<TooltipProps>(tooltipElement as React.ReactElement<TooltipProps>, {
      content: tooltipContent,
      position: { x: pos.pageX, y: pos.pageY },
      offset: { x: 10, y: 10 },
    });
  };

  renderContextMenu = () => {
    const { series } = this.props;
    const { contextPos, contextItem, isContextVisible } = this.state;

    if (!isContextVisible || !contextPos || !contextItem || series.length === 0) {
      return null;
    }

    // Indicates column(field) index in y-axis dimension
    const seriesIndex = contextItem ? contextItem.series.seriesIndex : 0;
    // Indicates row index in context field values
    const rowIndex = contextItem ? contextItem.dataIndex : undefined;

    const contextDimensions: ContextDimensions<GraphDimensions> = {
      // Described x-axis context item
      xAxis: [seriesIndex, rowIndex],
      // Describes y-axis context item
      yAxis: contextItem ? [contextItem.series.seriesIndex, contextItem.dataIndex] : null,
    };

    const dimensions: GraphDimensions = {
      // time/value dimension columns are index-aligned - see getGraphSeriesModel
      xAxis: createDimension(
        'xAxis',
        series.map(s => s.timeField)
      ),
      yAxis: createDimension(
        'yAxis',
        series.map(s => s.valueField)
      ),
    };

    const formatDate = (date: DateTimeInput, format?: string) => {
      return dateTime(date)?.format(format);
    };

    const closeContext = () => this.setState({ isContextVisible: false });

    const getContextMenuSource = () => {
      return {
        datapoint: contextItem.datapoint,
        dataIndex: contextItem.dataIndex,
        series: contextItem.series,
        seriesIndex: contextItem.series.seriesIndex,
        pageX: contextPos.pageX,
        pageY: contextPos.pageY,
      };
    };

    const contextContentProps: GraphContextMenuProps = {
      x: contextPos.pageX,
      y: contextPos.pageY,
      onClose: closeContext,
      getContextMenuSource: getContextMenuSource,
      formatSourceDate: formatDate,
      dimensions,
      contextDimensions,
    };

    return <GraphContextMenu {...contextContentProps} />;
  };

  getBarWidth = () => {
    const { series } = this.props;
    return Math.min(...series.map(s => s.timeStep));
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
          // Dividig the width by 1.5 to make the bars not touch each other
          barWidth: showBars ? this.getBarWidth() / 1.5 : 1,
          zero: false,
          lineWidth: 0,
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
        timezone: timeZone ?? DefaultTimeZone,
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
      $.plot(
        this.element,
        series.filter(s => s.isVisible),
        flotOptions
      );
    } catch (err) {
      console.log('Graph rendering error', err, flotOptions, series);
      throw new Error('Error rendering panel');
    }
  }

  render() {
    const { height, width, series } = this.props;
    const noDataToBeDisplayed = series.length === 0;
    const tooltip = this.renderTooltip();
    const context = this.renderContextMenu();
    return (
      <div className="graph-panel">
        <div
          className="graph-panel__chart"
          ref={e => (this.element = e)}
          style={{ height, width }}
          onMouseLeave={() => {
            this.setState({ isTooltipVisible: false });
          }}
        />
        {noDataToBeDisplayed && <div className="datapoints-warning">No data</div>}
        {tooltip}
        {context}
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
