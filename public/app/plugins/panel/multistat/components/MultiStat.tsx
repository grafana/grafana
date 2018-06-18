import _ from 'lodash';
import React from 'react';
import { ISize, Panel, Layout } from '../types';
import { MultiStatBar } from './MultiStatBar';
import { MultiStatHorizontal } from './MultiStatHorizontal';

// const MAX_BAR_LAYOUT_WIDTH = 500;

export interface IProps {
  stats: any[];
  options: Panel;
  size: ISize;
}

export class MultiStat extends React.Component<IProps, any> {
  constructor(props) {
    super(props);
  }

  render() {
    const options = this.props.options;
    const thresholds = getThresholds(options.thresholds);
    const colorMap = options.colors;
    const getColor = getColorFunc(thresholds, colorMap);
    // const rootWidth = this.props.size.w;
    if (options.layout === Layout.Vertical) {
      return <MultiStatBar {...this.props} getColor={getColor} />;
    } else {
      return <MultiStatHorizontal {...this.props} getColor={getColor} />;
    }
  }
}

function getThresholds(thresholds: string): number[] {
  return _.map(thresholds.split(','), strValue => Number(strValue.trim()));
}

function getColorForValue(value: number, thresholds: number[], colorMap: string[]): string {
  if (!_.isFinite(value)) {
    return null;
  }

  for (var i = thresholds.length; i > 0; i--) {
    if (value >= thresholds[i - 1]) {
      return colorMap[i];
    }
  }

  return _.first(colorMap);
}

function getColorFunc(thresholds: number[], colorMap: string[]): (v: number) => string {
  return value => getColorForValue(value, thresholds, colorMap);
}
