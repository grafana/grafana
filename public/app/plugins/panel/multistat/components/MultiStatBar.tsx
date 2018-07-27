import _ from 'lodash';
import React from 'react';
import * as Series from 'app/types/series';
import * as MultiStatPanel from '../types';
import { BarStat } from './BarStat';

export interface MultiStatBarProps {
  stats: Series.SeriesStat[];
  options: MultiStatPanel.PanelOptions;
  size: MultiStatPanel.PanelSize;
  getColor: (v: number) => string;
}

export function MultiStatBar(props: MultiStatBarProps) {
  const stats = props.stats || [];
  const { colorValue, layout } = props.options;
  let barLengths = _.map(stats, () => null);

  let rootElemLength = layout === 'horizontal' ? props.size.h : props.size.w;
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
  const totalWidth = layout === 'horizontal' ? props.size.w : props.size.h;
  const barWidth = stats.length > 0 ? totalWidth / stats.length : 0;
  const valueOutOfBar = isValuesOutOfBar(barLengths, layout);

  let direction: MultiStatPanel.PanelLayout;
  if (layout === 'vertical') {
    direction = 'vertical';
  } else {
    direction = 'horizontal';
  }

  const statElements = stats.map((stat, index) => {
    const { label, value, valueFormatted } = stat;
    const color = props.getColor(value);
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
        label={label}
        value={valueFormatted}
        color={color}
        colorValue={colorValue}
        width={barSize.w}
        height={barSize.h}
        valueOutOfBar={valueOutOfBar}
        direction={direction}
        style={barContainerStyle}
      />
    );
  });

  const classSuffix = direction;
  const className = `multistat-bars--${classSuffix}`;

  return <div className={className}>{statElements}</div>;
}

function isValuesOutOfBar(barWidths: number[], layout: MultiStatPanel.PanelLayout): boolean {
  const minLength = layout === 'vertical' ? 120 : 90;
  const minBarWidth = _.min(barWidths);
  const valuesOutOfBar = minBarWidth < minLength;
  return valuesOutOfBar;
}
