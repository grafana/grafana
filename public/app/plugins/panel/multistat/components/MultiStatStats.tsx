import React from 'react';
import * as Series from 'app/types/series';
import * as MultiStatPanel from '../types';
import { SingleStat, SingleStatProps } from './SingleStat';

export interface MultiStatStatsProps {
  stats: Series.SeriesStat[];
  options: MultiStatPanel.PanelOptions;
  size: MultiStatPanel.PanelSize;
  getColor: (v: number) => string;
}

export function MultiStatStats(props: MultiStatStatsProps) {
  const { stats } = props;
  const { layout, colorValue, colorBackground, sparkline } = props.options;
  let size: MultiStatPanel.PanelSize;
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
    const { label, valueFormatted, flotpairs } = stat;
    const color = props.getColor(stat.value);
    let optionalProps: Partial<SingleStatProps> = { color, colorValue, colorBackground, sparkline };
    if (sparkline.show) {
      optionalProps.flotpairs = flotpairs;
    }

    return (
      <SingleStat
        key={index}
        width={size.w}
        height={size.h}
        layout={layout}
        label={label}
        value={valueFormatted}
        {...optionalProps}
      />
    );
  });

  const className = `multistat-container multistat-container--${classSuffix}`;
  return <div className={className}>{statElements}</div>;
}
