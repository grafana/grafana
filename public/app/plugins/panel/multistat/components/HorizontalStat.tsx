import React from 'react';
import { SparkLine } from './SparkLine';
import { IStat, ISize } from '../types';
import { getBGColor } from './shared';

export interface IProps {
  stat: IStat;
  size?: ISize;
  color?: string;
  options?: any;
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
      background: bgColor,
    };
    let valueStyle: React.CSSProperties = {
      color: valueColor,
    };

    return (
      <div className="singlestat-panel-value-container multistat-horizontal" style={containerStyle}>
        <span className="singlestat-panel-value multistat-value-container" style={valueStyle}>
          {stat.valueFormatted}
        </span>
        <SparkLine stat={stat} options={this.props.options} color={valueColor} size={this.props.size} />
      </div>
    );
  }
}
