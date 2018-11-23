import React, { PureComponent, CSSProperties } from 'react';
import withTimeSeriesTooltip, {
  TimeSeriesTooltipProps,
  InjectedTooltipProps,
  TimeSeriesTooltipState,
} from './TimeSeriesTooltip';
import { TimeSeriesVM } from 'app/types';

interface GraphTooltipSpecificProps {}

interface GraphTooltipSpecificState {}

export type GraphTooltipProps = TimeSeriesTooltipProps & GraphTooltipSpecificProps;
export type GraphTooltipState = TimeSeriesTooltipState & GraphTooltipSpecificState;

export class GraphTooltip extends PureComponent<GraphTooltipProps & InjectedTooltipProps, GraphTooltipState> {
  constructor(props) {
    super(props);
  }

  render() {
    // console.log('render <GraphTooltip />');
    const timeFormat = 'YYYY-MM-DD HH:mm:ss';
    // const time = this.props.position.x;
    const time = this.props.timestamp;
    const absoluteTime = this.props.dateFormat(time, timeFormat);
    const seriesItems = this.props.series.map((series, index) => <TooltipSeries key={index} {...series} />);

    return [
      <div className="graph-tooltip-time timeseries-tooltip-time" key="time">
        {absoluteTime}
      </div>,
      ...seriesItems,
    ];
  }
}

type TooltipSeriesProps = TimeSeriesVM;

class TooltipSeries extends PureComponent<TooltipSeriesProps> {
  render() {
    const iconStyle: CSSProperties = {
      color: this.props.color,
    };

    return (
      <div className="graph-tooltip-list-item">
        <div className="graph-tooltip-series-name">
          <i className="fa fa-minus" style={iconStyle} />
          &nbsp;{this.props.label}:
        </div>
      </div>
    );
  }
}

export default withTimeSeriesTooltip(GraphTooltip);
