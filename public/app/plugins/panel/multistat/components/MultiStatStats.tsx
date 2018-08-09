import _ from 'lodash';
import React from 'react';
import * as Series from 'app/types/series';
import * as MultiStatPanel from '../types';
import { SingleStat, SingleStatProps } from './SingleStat';
import { getFontSize } from './utils';

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

  if (layout === 'vertical') {
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

  const widthRatio = size.w / (sparkline.show ? size.h * 0.75 : size.h);
  const labelToTheLeft = widthRatio > 3;

  const fontSizes = stats.map(stat => {
    const textAreaHeight = size.h * (sparkline.show ? 0.5 : 0.6);
    const textAreaWidth = size.w;
    const text = labelToTheLeft ? stat.valueFormatted + stat.label : stat.valueFormatted;
    const labelText = labelToTheLeft ? text : stat.label;
    return {
      value: getFontSize(text, textAreaWidth, textAreaHeight),
      label: getFontSize(labelText, textAreaWidth, textAreaHeight),
    };
  });
  const FONT_SIZE_COEF = 1.4;
  const fontSize = Math.floor(_.min(_.map(fontSizes, 'value')) * FONT_SIZE_COEF);
  const labelFontSize = Math.min(Math.floor(_.min(_.map(fontSizes, 'label')) * FONT_SIZE_COEF), fontSize);

  const statElements = stats.map((stat, index) => {
    const { label, valueFormatted, flotpairs } = stat;
    const color = props.getColor(stat.value);
    let optionalProps: Partial<SingleStatProps> = {
      color,
      colorValue,
      colorBackground,
      sparkline,
      fontSize,
      labelFontSize,
      labelToTheLeft,
    };
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
