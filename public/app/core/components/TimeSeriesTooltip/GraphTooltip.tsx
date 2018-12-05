import React, { PureComponent, CSSProperties } from 'react';
import withTimeSeriesTooltip, { InjectedTimeSeriesTooltipProps } from './TimeSeriesTooltip';
import { TimeSeriesVM } from 'app/types';
import { PlotHoverInfoItem } from './utils';
import { FlotHoverItem } from 'app/types/events';

export interface GraphTooltipProps extends InjectedTimeSeriesTooltipProps {
  formatDate: (time, format?) => string;
}

export class GraphTooltip extends PureComponent<GraphTooltipProps> {
  render() {
    const { series, hoverInfo, item, timestamp, formatDate } = this.props;
    const timeFormat = 'YYYY-MM-DD HH:mm:ss';
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

export default withTimeSeriesTooltip(GraphTooltip);
