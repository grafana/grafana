import React from 'react';
import { SeriesStat, MultistatPanelSize, MultistatPanelOptions, MultistatPanelLayout } from '../types';
import { getBGColor } from './utils';

export interface IProps {
  stat: SeriesStat;
  size?: MultistatPanelSize;
  color?: string;
  direction?: MultistatPanelLayout;
  options?: MultistatPanelOptions;
  valueOutOfBar?: boolean;
  style?: React.CSSProperties;
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
    const verticalDirection = this.props.direction === MultistatPanelLayout.Vertical;

    let valueContainerStyle: React.CSSProperties = {};
    let valueStyle: React.CSSProperties = {};
    let barLabelStyle: React.CSSProperties = {};
    let barStyle: React.CSSProperties = {};
    let barContainerStyle: React.CSSProperties = this.props.style || {};
    if (this.props.size) {
      barStyle.background = bgColor;
      if (verticalDirection) {
        barContainerStyle.height = this.props.size.h;
        barContainerStyle.width = this.props.size.w;
        const barWidth = this.props.size.h * 0.8;
        barStyle.height = barWidth;
        barStyle.width = this.props.size.w;
        barContainerStyle.lineHeight = `${barWidth}px`;
      } else {
        const barWidth = this.props.size.w * 0.8;
        barStyle.width = barWidth;
        barStyle.height = this.props.size.h - 10;
        barContainerStyle.height = this.props.size.h - 10;
        barContainerStyle.width = barWidth;
        const valueOffset = this.props.valueOutOfBar ? 10 : -10;
        valueContainerStyle.bottom = this.props.size.h + valueOffset;
        barLabelStyle.bottom = 5;
        barLabelStyle.left = barWidth / 2 - 10;
        // barLabelStyle.writingMode = 'vertical-rl';
        // barLabelStyle.transform = 'rotate(-180deg)';
      }
    }

    if (this.props.options.colorValue) {
      valueStyle.color = valueColor;
      if (verticalDirection) {
        barStyle.borderRightColor = valueColor;
      } else {
        barStyle.borderTopColor = valueColor;
      }
    }

    const barContainerClass = `multistat-bar-container multistat-bar-container--${this.props.direction}`;

    return (
      <div className={barContainerClass} style={barContainerStyle}>
        <div className="multistat-bar" style={barStyle} ref={el => (this.barElem = el)}>
          <span className="bar-label bar-label--vertical" style={barLabelStyle} ref={el => (this.labelElem = el)}>
            {stat.label}
          </span>
          {!this.props.valueOutOfBar && (
            <span className="bar-value" style={valueStyle} ref={el => (this.valueElem = el)}>
              {stat.valueFormatted}
            </span>
          )}
        </div>
        {this.props.valueOutOfBar && (
          <div className="value-container" style={valueContainerStyle}>
            <span className="bar-value" style={valueStyle} ref={el => (this.valueElem = el)}>
              {stat.valueFormatted}
            </span>
          </div>
        )}
      </div>
    );
  }
}
