import React from 'react';
import { getBGColor } from './shared';

interface IStat {
  alias?: string;
  label?: string;
  value: number;
  valueRounded: number;
  valueFormatted: string;
  flotpairs: any[];
  scopedVars?: any;
}

export interface IProps {
  stat: IStat;
  width?: number;
  color?: string;
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
      width: this.props.width,
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
      </div>
    );
  }
}
