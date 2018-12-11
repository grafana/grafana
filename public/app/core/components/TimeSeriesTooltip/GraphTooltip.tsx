import React, { PureComponent, CSSProperties } from 'react';
// import { TimeSeriesVM } from 'app/types';
import { FlotHoverItem } from 'app/types/events';
import { PlotHoverInfoItem } from './utils';
import { TimeAxisTooltipProps } from './TimeAxisTooltip';
import TimeSeriesTooltip, { TimeSeriesTooltipProps } from './TimeSeriesTooltip';

export interface GraphTooltipContentProps {
  formatDate: (time, format?) => string;
}

export type GraphTooltipProps = GraphTooltipContentProps & TimeSeriesTooltipProps & TimeAxisTooltipProps;

export class GraphTooltip extends PureComponent<GraphTooltipProps> {
  renderGraphTooltip = (seriesList, item: FlotHoverItem, timestamp: number, hoverInfo: PlotHoverInfoItem[]) => {
    let timeFormat = 'YYYY-MM-DD HH:mm:ss';
    if (seriesList && seriesList.length && seriesList[0].stats.hasMsResolution) {
      timeFormat += '.SSS';
    }
    const absoluteTime = this.props.formatDate(timestamp, timeFormat);

    const hoverInfoFiltered = hoverInfo.filter(hoverItem => !hoverItem.hidden);
    const seriesItems = hoverInfoFiltered.map((hoverItem, index) => {
      const series = seriesList[hoverItem.index];
      const value = series.formatValue(hoverItem.value);
      const highlightItem = item && hoverItem.index === item.seriesIndex;
      return (
        <TooltipSeries
          key={index}
          label={hoverItem.label}
          color={hoverItem.color}
          value={value}
          highlight={highlightItem}
        />
      );
    });

    return [
      <div className="graph-tooltip-time timeseries-tooltip-time" key="time">
        {absoluteTime}
      </div>,
      ...seriesItems,
    ];
  };

  render() {
    return <TimeSeriesTooltip {...this.props}>{this.renderGraphTooltip}</TimeSeriesTooltip>;
  }
}

interface TooltipSeriesProps {
  label: string;
  color: string;
  value: string;
  highlight?: boolean;
}

class TooltipSeries extends PureComponent<TooltipSeriesProps> {
  render() {
    const { label, color, value, highlight } = this.props;
    const iconStyle: CSSProperties = { color };

    return (
      <div className={`graph-tooltip-list-item ${highlight && 'graph-tooltip-list-item--highlight'}`}>
        <div className="graph-tooltip-series-name">
          <i className="fa fa-minus" style={iconStyle} />
          &nbsp;{label}:
        </div>
        <div className="graph-tooltip-value">{value}</div>
      </div>
    );
  }
}

export default GraphTooltip;
