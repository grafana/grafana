import React from 'react';
import { ThresholdHandler } from './ThresholdHandler';

export interface IProps {
  thresholds: any[];
  className?: any;
  yPos: (v: any) => any;
  yPosInvert: (v: any) => any;
  onChange: (v: any, i: number) => any;
}

export class ThresholdManager extends React.Component<IProps, any> {
  constructor(props) {
    super(props);

    this.state = {
      value: 0,
    };
  }

  onChange(index, newValue) {
    this.props.onChange(newValue, index);
  }

  render() {
    const thresholds = this.props.thresholds.slice(0, 2);
    const thresholdHandlers = thresholds.map((threshold, i) => {
      let style = {};
      if (this.props.thresholds.length > 1 && i === 0) {
        style = { right: '129px' };
      } else if (this.props.thresholds.length === 1 && i === 0) {
        style = { right: '13px' };
      }
      return (
        <ThresholdHandler
          style={style}
          key={i.toString()}
          index={i}
          threshold={threshold}
          yPos={this.props.yPos}
          yPosInvert={this.props.yPosInvert}
          onChange={this.onChange.bind(this, i)}
        />
      );
    });

    const elemWidth = this.props.thresholds.length > 1 ? 245 : 129;
    const style = { width: elemWidth };

    return (
      <div className={this.props.className} style={style}>
        {thresholdHandlers}
      </div>
    );
  }
}
