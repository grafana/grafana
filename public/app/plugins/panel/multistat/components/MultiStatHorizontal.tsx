// import _ from 'lodash';
import React from 'react';
import { SingleStat } from './SingleStat';
import { MultistatPanelSize } from '../types';

export interface IProps {
  stats: any[];
  options: any;
  size: MultistatPanelSize;
  getColor: (v: number) => string;
}

export class MultiStatHorizontal extends React.Component<IProps, any> {
  constructor(props) {
    super(props);
  }

  render() {
    const stats = this.props.stats || [];
    const rootElemWidth = this.props.size.w;
    const statWidth = stats.length > 0 ? rootElemWidth / stats.length : 0;
    const size = { w: statWidth, h: this.props.size.h };

    const statElements = stats.map((stat, index) => {
      const color = this.props.getColor(stat.value);
      return <SingleStat key={index} stat={stat} color={color} size={size} options={this.props.options} />;
    });

    return <div className="multistat-container">{statElements}</div>;
  }
}
