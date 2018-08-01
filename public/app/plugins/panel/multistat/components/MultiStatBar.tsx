import _ from 'lodash';
import React from 'react';
import * as Series from 'app/types/series';
import * as MultiStatPanel from '../types';
import { BarStat, BarStatProps } from './BarStat';
import { getFontSize, isValuesOutOfBar } from './utils';

export interface MultiStatBarProps {
  stats: Series.SeriesStat[];
  options: MultiStatPanel.PanelOptions;
  size: MultiStatPanel.PanelSize;
  getColor: (v: number) => string;
}

export function MultiStatBar(props: MultiStatBarProps) {
  const stats = props.stats || [];
  const { colorValue, layout } = props.options;
  let barLengths: number[] = _.map(stats, () => null);

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

  let direction: MultiStatPanel.PanelLayout;
  if (layout === 'vertical') {
    direction = 'vertical';
  } else {
    direction = 'horizontal';
  }

  const maxLabelLength = getMaxLabelLength(stats);
  const maxValueLength = getMaxValueLength(stats);
  const maxTotalLength = maxLabelLength + maxValueLength;
  const minBarLength = _.min(barLengths);
  const minTextCellWidth = _.min(
    barLengths.map((barLength, i) => {
      const totalTextLength = stats[i].label.length + stats[i].valueFormatted.length;
      return barLength / totalTextLength;
    })
  );
  const fontSize = getFontSize(minTextCellWidth, barWidth);
  const valueOutOfBar = isValuesOutOfBar(minBarLength, barWidth, minTextCellWidth, maxTotalLength);

  const statElements = stats.map((stat, index) => {
    const { label, value, valueFormatted } = stat;
    const color = props.getColor(value);
    let barSize;
    let styleLeft;
    if (direction === 'horizontal') {
      barSize = { w: barWidth, h: barLengths[index] };
      styleLeft = barWidth * index;
    } else {
      barSize = { w: barLengths[index], h: barWidth };
    }

    const optionalStyles: Partial<BarStatProps> = { color, colorValue, direction, valueOutOfBar, styleLeft, fontSize };

    return (
      <BarStat
        key={index}
        label={label}
        value={valueFormatted}
        width={barSize.w}
        height={barSize.h}
        {...optionalStyles}
      />
    );
  });

  const classSuffix = direction;
  const className = `multistat-bars--${classSuffix}`;

  return <div className={className}>{statElements}</div>;
}

function getMaxLabelLength(stats: Series.SeriesStat[]): number {
  const labels = stats.map(s => s.label);
  return _.max(labels.map(l => l.length));
}

function getMaxValueLength(stats: Series.SeriesStat[]): number {
  const values = stats.map(s => s.valueFormatted);
  return _.max(values.map(v => v.length));
}
