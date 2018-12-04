import React, { PureComponent, CSSProperties } from 'react';
import withTimeSeriesTooltip, {
  TimeSeriesTooltipProps,
  InjectedTimeSeriesTooltipProps,
  TimeSeriesTooltipState,
} from './TimeSeriesTooltip';
import { TimeSeriesVM } from 'app/types';
import { PlotHoverInfoItem } from './utils';
import { FlotHoverItem } from 'app/types/events';
import { InjectedTimeAxisTooltipProps } from './TimeAxisTooltip';

export interface GraphTooltipProps extends TimeSeriesTooltipProps {}

export interface GraphTooltipState extends TimeSeriesTooltipState {}

type InjectedGraphTooltipProps = InjectedTimeSeriesTooltipProps & InjectedTimeAxisTooltipProps;

export class GraphTooltip extends PureComponent<GraphTooltipProps & InjectedGraphTooltipProps, GraphTooltipState> {
  constructor(props) {
    super(props);
  }

  render() {
    // console.log('render <GraphTooltip />');
    const { series, item, timestamp } = this.props;
    const timeFormat = 'YYYY-MM-DD HH:mm:ss';
    // const time = this.props.position.x;
    const absoluteTime = this.props.formatDate(timestamp, timeFormat);
    const seriesItems = this.props.hoverInfo.map((hoverItem, index) => (
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
    // console.log(this.props);
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
