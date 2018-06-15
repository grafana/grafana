// import _ from 'lodash';
import React from 'react';
import { HorizontalStat } from './HorizontalStat';

export interface IProps {
  stats: any[];
  options: any;
  width: number;
  getColor: (v: number) => string;
}

export class MultiStatHorizontal extends React.Component<IProps, any> {
  constructor(props) {
    super(props);
  }

  render() {
    const stats = this.props.stats || [];
    const rootElemWidth = this.props.width;
    const statWidth = stats.length > 0 ? rootElemWidth / stats.length : 0;

    const statElements = stats.map((stat, index) => {
      const color = this.props.getColor(stat.value);
      return <HorizontalStat key={index} stat={stat} color={color} width={statWidth} />;
    });

    return <div className="multistat-container">{statElements}</div>;
  }
}
