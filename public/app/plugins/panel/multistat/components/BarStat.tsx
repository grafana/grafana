import React from 'react';
import { SeriesStat, MultistatPanelSize, MultistatPanelOptions } from '../types';
import { getBGColor } from './utils';

export interface IProps {
  stat: SeriesStat;
  size?: MultistatPanelSize;
  color?: string;
  options?: MultistatPanelOptions;
  valueOutOfBar?: boolean;
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

    let valueStyle: React.CSSProperties = {};
    let barStyle: React.CSSProperties = {};
    let barContainerStyle: React.CSSProperties = {};
    if (this.props.size) {
      const barHeight = this.props.size.h * 0.8;
      barStyle.background = bgColor;
      barStyle.height = barHeight;
      barStyle.width = this.props.size.w;
      barContainerStyle.lineHeight = `${barHeight}px`;
      barContainerStyle.height = this.props.size.h;
    }

    if (this.props.options.colorValue) {
      valueStyle.color = valueColor;
      barStyle.borderRightColor = valueColor;
    }

    return (
      <div className="multistat-bar-container" style={barContainerStyle}>
        <div className="multistat-bar" style={barStyle} ref={el => (this.barElem = el)}>
          <span className="bar-label" ref={el => (this.labelElem = el)}>
            {stat.label}
          </span>
          {!this.props.valueOutOfBar && (
            <span className="bar-value" style={valueStyle} ref={el => (this.valueElem = el)}>
              {stat.valueFormatted}
            </span>
          )}
        </div>
        {this.props.valueOutOfBar && (
          <div className="multistat-bar-value-container">
            <span className="bar-value" style={valueStyle} ref={el => (this.valueElem = el)}>
              {stat.valueFormatted}
            </span>
          </div>
        )}
      </div>
    );
  }
}
