import _ from 'lodash';
import React from 'react';
import { BarStat } from './BarStat';
import { MultistatPanelSize, MultistatPanelOptions } from '../types';

export interface IProps {
  stats: any[];
  options: MultistatPanelOptions;
  size: MultistatPanelSize;
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

    const rootElemWidth = this.props.size.w;
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
    const barHeight = stats.length > 0 ? this.props.size.h / stats.length : 0;

    const statElements = stats.map((stat, index) => {
      const color = this.props.getColor(stat.value);
      const barSize = { w: barWidths[index], h: barHeight };
      return <BarStat key={index} stat={stat} color={color} size={barSize} options={this.props.options} />;
    });

    return <div>{statElements}</div>;
  }
}
