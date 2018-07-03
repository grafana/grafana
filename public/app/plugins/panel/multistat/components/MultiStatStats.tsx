// import _ from 'lodash';
import React from 'react';
import { SingleStat } from './SingleStat';
import { MultistatPanelSize, MultistatPanelOptions, MultistatPanelLayout } from '../types';

export interface IProps {
  stats: any[];
  options: MultistatPanelOptions;
  size: MultistatPanelSize;
  getColor: (v: number) => string;
}

export class MultiStatStats extends React.Component<IProps, any> {
  constructor(props) {
    super(props);
  }

  render() {
    const stats = this.props.stats || [];
    let size;
    let classSuffix;
    if (this.props.options.layout === MultistatPanelLayout.Vertical) {
      classSuffix = 'vertical';
      const rootElemHeight = this.props.size.h - 30;
      const statHeight = stats.length > 0 ? rootElemHeight / stats.length : 0;
      size = { w: this.props.size.w, h: statHeight };
    } else {
      classSuffix = 'horizontal';
      const rootElemWidth = this.props.size.w;
      const statWidth = stats.length > 0 ? rootElemWidth / stats.length : 0;
      size = { w: statWidth, h: this.props.size.h };
    }

    const statElements = stats.map((stat, index) => {
      const color = this.props.getColor(stat.value);
      return <SingleStat key={index} stat={stat} color={color} size={size} options={this.props.options} />;
    });

    const className = `multistat-container multistat-container--${classSuffix}`;
    return <div className={className}>{statElements}</div>;
  }
}
