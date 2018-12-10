import React, { PureComponent, CSSProperties } from 'react';
import { TimeSeriesVM } from 'app/types';
import { FlotHoverItem } from 'app/types/events';
import { PlotHoverInfoItem } from './utils';
import { TimeAxisTooltipProps } from './TimeAxisTooltip';
import TimeSeriesTooltip, { InjectedTimeSeriesTooltipProps, TimeSeriesTooltipProps } from './TimeSeriesTooltip';

export interface GraphTooltipContentProps {
  formatDate: (time, format?) => string;
}

type ComponentProps = GraphTooltipContentProps & InjectedTimeSeriesTooltipProps;

export class GraphTooltipContent extends PureComponent<ComponentProps> {
  render() {
    const { series, hoverInfo, item, timestamp, formatDate } = this.props;
    let timeFormat = 'YYYY-MM-DD HH:mm:ss';
    if (series && series.length && series[0].stats.hasMsResolution) {
      timeFormat += '.SSS';
    }
    const absoluteTime = formatDate(timestamp, timeFormat);
    const hoverInfoFiltered = hoverInfo.filter(hoverItem => !hoverItem.hidden);
    const seriesItems = hoverInfoFiltered.map((hoverItem, index) => (
      <TooltipSeries key={index} hoverItem={hoverItem} seriesList={series} item={item} />
    ));

    return [
      <div className="graph-tooltip-time timeseries-tooltip-time" key="time">
        {absoluteTime}
      </div>,
      ...seriesItems,
    ];
  }
}

interface TooltipSeriesProps {
  seriesList: TimeSeriesVM[] | any;
  hoverItem: PlotHoverInfoItem;
  item: FlotHoverItem;
}

class TooltipSeries extends PureComponent<TooltipSeriesProps> {
  render() {
    const { seriesList, hoverItem, item } = this.props;
    const series = seriesList[hoverItem.index];
    const value = series.formatValue(hoverItem.value);
    const highlightItem = item && hoverItem.index === item.seriesIndex;

    const iconStyle: CSSProperties = {
      color: hoverItem.color,
    };

    return (
      <div className={`graph-tooltip-list-item ${highlightItem && 'graph-tooltip-list-item--highlight'}`}>
        <div className="graph-tooltip-series-name">
          <i className="fa fa-minus" style={iconStyle} />
          &nbsp;{hoverItem.label}:
        </div>
        <div className="graph-tooltip-value">{value}</div>
      </div>
    );
  }
}

export type GraphTooltipProps = GraphTooltipContentProps & TimeSeriesTooltipProps & TimeAxisTooltipProps;

export class GraphTooltip extends PureComponent<GraphTooltipProps> {
  render() {
    return (
      <TimeSeriesTooltip {...this.props}>
        {(series, item, timestamp, hoverInfo) => (
          <GraphTooltipContent
            {...this.props}
            series={series}
            item={item}
            timestamp={timestamp}
            hoverInfo={hoverInfo}
          />
        )}
      </TimeSeriesTooltip>
    );
  }
}

export default GraphTooltip;
