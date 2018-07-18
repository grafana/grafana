import _ from 'lodash';
import React from 'react';
import thresholdColors from './ThresholdManager/thresholdColors';
import { MultiStatBar } from './MultiStatBar';
import { MultiStatStats } from './MultiStatStats';

export interface Props {
  stats: any[];
  options: MultiStat.PanelOptions;
  size: MultiStat.PanelSize;
}

export function MultiStatPanel(props: Props) {
  const options = props.options;
  const thresholds = props.options.thresholds;
  const getColor = getColorFunc(thresholds);

  if (options.viewMode === 'bars') {
    return <MultiStatBar {...props} getColor={getColor} />;
  } else {
    return <MultiStatStats {...props} getColor={getColor} />;
  }
}

function getColorForValue(value: number, thresholds: MultiStat.ThresholdModel[]): string {
  if (!_.isFinite(value)) {
    return null;
  }

  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (value >= thresholds[i].value) {
      if (thresholds[i].mode === 'custom') {
        return thresholds[i].color;
      }
      return thresholdColors.getColor(thresholds[i].mode);
    }
  }

  return null;
}

function getColorFunc(thresholds: MultiStat.ThresholdModel[]): (v: number) => string {
  return value => getColorForValue(value, thresholds);
}
