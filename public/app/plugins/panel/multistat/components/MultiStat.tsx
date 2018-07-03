import _ from 'lodash';
import React from 'react';
import { MultistatPanelSize, MultistatPanelOptions, MultistatPanelViewMode } from '../types';
import { ThresholdModel, ThresholdMode } from './ThresholdManager/ThresholdEditor';
// import { MultiStatBar } from './MultiStatBar';
import thresholdColors from './ThresholdManager/thresholdColors';
import { MultiStatBar } from './MultiStatBar';
import { MultiStatStats } from './MultiStatStats';

// const MAX_BAR_LAYOUT_WIDTH = 500;

export interface IProps {
  stats: any[];
  options: MultistatPanelOptions;
  size: MultistatPanelSize;
}

export class MultiStat extends React.Component<IProps, any> {
  constructor(props) {
    super(props);
  }

  render() {
    const options = this.props.options;
    const thresholds = this.props.options.thresholds;
    const getColor = getColorFunc(thresholds);

    // const rootWidth = this.props.size.w;
    if (options.viewMode === MultistatPanelViewMode.Bars) {
      return <MultiStatBar {...this.props} getColor={getColor} />;
    } else {
      return <MultiStatStats {...this.props} getColor={getColor} />;
    }
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
