import _ from 'lodash';
import React from 'react';
import { BarStat } from './BarStat';

export interface IProps {
  stats: any[];
  options: any;
  width: number;
  getColor: (v: number) => string;
}

export class MultiStatBar extends React.Component<IProps, any> {
  constructor(props) {
    super(props);
  }

  render() {
    const stats = this.props.stats || [];
    let barWidths = _.map(stats, () => null);
    // console.log(this.props);

    const rootElemWidth = this.props.width;
    const values = _.map(stats, 'value');
    const maxVal = _.max(values);
    const minVal = _.min(values);
    const delta = maxVal - minVal;
    const minWidth = rootElemWidth * 0.3;
    const maxWidth = rootElemWidth * 0.9;
    const deltaWidth = maxWidth - minWidth;
    _.forEach(values, (v, i) => {
      let width = (v - minVal) / delta * deltaWidth + minWidth;
      barWidths[i] = Math.max(minWidth, width);
    });

    const statElements = stats.map((stat, index) => {
      const color = this.props.getColor(stat.value);
      return <BarStat key={index} stat={stat} color={color} width={barWidths[index]} />;
    });

    return <div>{statElements}</div>;
  }
}
