import React from 'react';
import tinycolor from 'tinycolor2';

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

const DEFAULT_COLOR = 'rgb(31, 120, 193)';

export class BarStat extends React.Component<IProps, any> {
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

    if (this.props.width) {
      barStyle.width = this.props.width;
    }

    const valueStyle: React.CSSProperties = {
      color: valueColor,
    };

    return (
      <div className="multistat-bar" style={barStyle}>
        <span className="bar-label">{stat.label}</span>
        <span className="bar-value" style={valueStyle}>
          {stat.valueFormatted}
        </span>
      </div>
    );
  }
}

function getBGColor(color: string): string {
  const tc = tinycolor(color);
  tc.setAlpha(0.3);
  return tc.toRgbString();
}
