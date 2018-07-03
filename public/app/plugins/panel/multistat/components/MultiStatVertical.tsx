// import _ from 'lodash';
import React from 'react';
import { SingleStat } from './SingleStat';
import { MultistatPanelSize, MultistatPanelOptions, MultistatPanelViewMode } from '../types';
import { MultiStatBar } from './MultiStatBar';

export interface IProps {
  stats: any[];
  options: MultistatPanelOptions;
  size: MultistatPanelSize;
  getColor: (v: number) => string;
}

export class MultiStatVertical extends React.Component<IProps, any> {
  constructor(props) {
    super(props);
  }

  render() {
    if (this.props.options.viewMode === MultistatPanelViewMode.Bars) {
      return <MultiStatBar {...this.props} />;
    }

    const stats = this.props.stats || [];
    const rootElemHeight = this.props.size.h - 30;
    const statHeight = stats.length > 0 ? rootElemHeight / stats.length : 0;
    const size = { w: this.props.size.w, h: statHeight };

    const statElements = stats.map((stat, index) => {
      const color = this.props.getColor(stat.value);
      return <SingleStat key={index} stat={stat} color={color} size={size} options={this.props.options} />;
    });

    return <div className="multistat-container--vertical">{statElements}</div>;
  }
}
