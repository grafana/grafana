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
  const minLength = rootElemLength * 0.3;
  const maxLength = rootElemLength * 0.9;
  const deltaLength = maxLength - minLength;
  _.forEach(values, (v, i) => {
    const length = (v - minVal) / delta * deltaLength + minLength;
    barLengths[i] = Math.max(minLength, length);
  });
  const totalWidth = layout === 'horizontal' ? props.size.w : props.size.h;
  const barWidth = stats.length > 0 ? totalWidth / stats.length : 0;
  const verticalLabel = minLength > barWidth;

  let direction: MultiStatPanel.PanelLayout;
  if (layout === 'vertical') {
    direction = 'vertical';
  } else {
    direction = 'horizontal';
  }

  const fontSizes = barLengths.map((barLength, i) => {
    const text = direction === 'horizontal' ? stats[i].label : stats[i].label + stats[i].valueFormatted;
    if (direction === 'horizontal' && !verticalLabel) {
      return getFontSize(text, barWidth, barLength);
    }
    return getFontSize(text, barLength, barWidth);
  });
  const fontSize = _.min(fontSizes);

  let valueFontSize = fontSize;
  if (direction === 'horizontal') {
    const valueFontSizes = stats.map(s => {
      return getFontSize(s.valueFormatted, barWidth);
    });
    valueFontSize = _.min(valueFontSizes.concat(fontSize));
  }

  let valueOutOfBar = false;
  barLengths.forEach((barLength, i) => {
    const text = direction === 'horizontal' ? stats[i].label : stats[i].label + stats[i].valueFormatted;
    const textLength = text.length;
    const isOutOfBar = isValuesOutOfBar(barLength, fontSize, textLength);
    if (isOutOfBar) {
      valueOutOfBar = true;
    }
  });

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

    const optionalProps: Partial<BarStatProps> = {
      color,
      colorValue,
      direction,
      valueOutOfBar,
      styleLeft,
      fontSize,
      valueFontSize,
      verticalLabel,
    };

    return (
      <BarStat
        key={index}
        label={label}
        value={valueFormatted}
        width={barSize.w}
        height={barSize.h}
        {...optionalProps}
      />
    );
  });

  const classSuffix = direction;
  const className = `multistat-bars--${classSuffix}`;

  return <div className={className}>{statElements}</div>;
}
