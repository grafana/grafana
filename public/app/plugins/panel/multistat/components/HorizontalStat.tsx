import React from 'react';
import { SparkLine } from './SparkLine';
import { SeriesStat, MultistatPanelSize, MultistatPanelOptions } from '../types';
import { getBGColor } from './utils';

export interface IProps {
  stat: SeriesStat;
  size?: MultistatPanelSize;
  color?: string;
  options?: MultistatPanelOptions;
}

export class HorizontalStat extends React.Component<IProps, any> {
  constructor(props) {
    super(props);
  }

  render() {
    const stat = this.props.stat;
    const valueColor = this.props.color;
    const bgColor = getBGColor(valueColor, 0.1);

    let containerStyle: React.CSSProperties = {
      width: this.props.size.w,
    };
    if (this.props.options.colorBackground) {
      containerStyle.background = bgColor;
    }

    let valueStyle: React.CSSProperties = {};
    if (this.props.options.colorValue) {
      valueStyle.color = valueColor;
    }

    return (
      <div className="multistat-horizontal" style={containerStyle}>
        <div className="multistat-label-container">
          <span className="multistat-label-horizontal">{stat.label}</span>
        </div>
        <div className="multistat-value-container">
          <span className="singlestat-panel-value multistat-value" style={valueStyle}>
            {stat.valueFormatted}
          </span>
        </div>
        {this.props.options.sparkline.show && (
          <SparkLine stat={stat} options={this.props.options} color={valueColor} size={this.props.size} />
        )}
      </div>
    );
  }
}
