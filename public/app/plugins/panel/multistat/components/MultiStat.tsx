import _ from 'lodash';
import React from 'react';
import { MultistatPanelSize, MultistatPanelOptions, MultistatPanelViewMode } from '../types';
import thresholdColors from './ThresholdManager/thresholdColors';
import { ThresholdModel, ThresholdMode } from './ThresholdManager/ThresholdEditor';
import { MultiStatBar } from './MultiStatBar';
import { MultiStatStats } from './MultiStatStats';

export interface IProps {
  stats: any[];
  options: MultistatPanelOptions;
  size: MultistatPanelSize;
}

export function MultiStat(props: IProps) {
  const options = props.options;
  const thresholds = props.options.thresholds;
  const getColor = getColorFunc(thresholds);

  if (options.viewMode === MultistatPanelViewMode.Bars) {
    return <MultiStatBar {...props} getColor={getColor} />;
  } else {
    return <MultiStatStats {...props} getColor={getColor} />;
  }
}

function getColorForValue(value: number, thresholds: ThresholdModel[]): string {
  if (!_.isFinite(value)) {
    return null;
  }

  for (var i = thresholds.length - 1; i >= 0; i--) {
    if (value >= thresholds[i].value) {
      if (thresholds[i].mode === ThresholdMode.custom) {
        return thresholds[i].color;
      }
      return thresholdColors.getColor(thresholds[i].mode);
    }
  }

  return null;
}

function getColorFunc(thresholds: ThresholdModel[]): (v: number) => string {
  return value => getColorForValue(value, thresholds);
}
