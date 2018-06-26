import React from 'react';
import { SeriesStat, MultistatPanelSize } from '../types';
import { getBGColor } from './utils';

export interface IProps {
  stat: SeriesStat;
  size?: MultistatPanelSize;
  color?: string;
}

const DEFAULT_COLOR = 'rgb(31, 120, 193)';

export class BarStat extends React.Component<IProps, any> {
  labelElem: any;
  valueElem: any;
  barElem: any;

  constructor(props) {
    super(props);
  }

  render() {
    // console.log(this.props);
    const stat = this.props.stat;
    const valueColor = this.props.color || DEFAULT_COLOR;
    const bgColor = getBGColor(valueColor);

    let barStyle: React.CSSProperties = {
      background: bgColor,
      borderRightColor: valueColor,
    };

    let barContainerStyle: React.CSSProperties = {};
    if (this.props.size) {
      const barHeight = this.props.size.h * 0.8;
      barStyle.height = barHeight;
      barContainerStyle.lineHeight = `${barHeight}px`;
      barContainerStyle.width = this.props.size.w;
      barContainerStyle.height = this.props.size.h;
    }

    const valueStyle: React.CSSProperties = {
      color: valueColor,
    };

    return (
      <div className="multistat-bar-container" style={barContainerStyle}>
        <div className="multistat-bar" style={barStyle} ref={el => (this.barElem = el)}>
          <span className="bar-label" ref={el => (this.labelElem = el)}>
            {stat.label}
          </span>
          <span className="bar-value" style={valueStyle} ref={el => (this.valueElem = el)}>
            {stat.valueFormatted}
          </span>
        </div>
      </div>
    );
  }
}
