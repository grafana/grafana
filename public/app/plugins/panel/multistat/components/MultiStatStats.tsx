import React from 'react';
import * as MultiStatPanel from '../types';
import { SingleStat } from './SingleStat';

export interface Props {
  stats: any[];
  options: MultiStatPanel.PanelOptions;
  size: MultiStatPanel.PanelSize;
  getColor: (v: number) => string;
}

export function MultiStatStats(props: Props) {
  const stats = props.stats;
  let size;
  let classSuffix;

  if (props.options.layout === 'vertical') {
    classSuffix = 'vertical';
    const rootElemHeight = props.size.h - 30;
    const statHeight = stats.length > 0 ? rootElemHeight / stats.length : 0;
    size = { w: props.size.w, h: statHeight };
  } else {
    classSuffix = 'horizontal';
    const rootElemWidth = props.size.w;
    const statWidth = stats.length > 0 ? rootElemWidth / stats.length : 0;
    size = { w: statWidth, h: props.size.h };
  }

  const statElements = stats.map((stat, index) => {
    const color = props.getColor(stat.value);
    return <SingleStat key={index} stat={stat} color={color} size={size} options={props.options} />;
  });

  const className = `multistat-container multistat-container--${classSuffix}`;
  return <div className={className}>{statElements}</div>;
}
