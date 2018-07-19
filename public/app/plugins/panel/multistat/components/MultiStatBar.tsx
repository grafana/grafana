import _ from 'lodash';
import React from 'react';
import { BarStat } from './BarStat';

export interface Props {
  stats: any[];
  options: Panel.MultiStat.PanelOptions;
  size: Panel.MultiStat.PanelSize;
  getColor: (v: number) => string;
}

export function MultiStatBar(props: Props) {
  function isValuesOutOfBar(barWidths: number[]): boolean {
    const minLength = props.options.layout === 'vertical' ? 120 : 90;
    const minBarWidth = _.min(barWidths);
    const valuesOutOfBar = minBarWidth < minLength;
    return valuesOutOfBar;
  }

  const stats = props.stats || [];
  const options = props.options;
  let barLengths = _.map(stats, () => null);

  let rootElemLength = options.layout === 'horizontal' ? props.size.h : props.size.w;
  const values = _.map(stats, 'value');
  const maxVal = _.max(values);
  const minVal = _.min(values);
  const delta = maxVal - minVal;
  const minWidth = rootElemLength * 0.3;
  const maxWidth = rootElemLength * 0.9;
  const deltaWidth = maxWidth - minWidth;
  _.forEach(values, (v, i) => {
    let width = (v - minVal) / delta * deltaWidth + minWidth;
    barLengths[i] = Math.max(minWidth, width);
  });
  const totalWidth = options.layout === 'horizontal' ? props.size.w : props.size.h;
  const barWidth = stats.length > 0 ? totalWidth / stats.length : 0;
  const valueOutOfBar = isValuesOutOfBar(barLengths);

  let direction: Panel.MultiStat.PanelLayout;
  if (options.layout === 'vertical') {
    direction = 'vertical';
  } else {
    direction = 'horizontal';
  }

  const statElements = stats.map((stat, index) => {
    const color = props.getColor(stat.value);
    let barSize;
    let barContainerStyle: React.CSSProperties = {};
    if (direction === 'horizontal') {
      barSize = { w: barWidth, h: barLengths[index] };
      barContainerStyle.left = barWidth * index;
    } else {
      barSize = { w: barLengths[index], h: barWidth };
    }

    return (
      <BarStat
        key={index}
        stat={stat}
        color={color}
        size={barSize}
        valueOutOfBar={valueOutOfBar}
        direction={direction}
        style={barContainerStyle}
        options={options}
      />
    );
  });

  const classSuffix = direction;
  const className = `multistat-bars--${classSuffix}`;

  return <div className={className}>{statElements}</div>;
}
