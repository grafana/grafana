import _ from 'lodash';
import React from 'react';
import { react2AngularDirective } from 'app/core/utils/react2angular';
import { BarStat } from './BarStat';

export interface IProps {
  stats: any[];
  options: any;
}

export class MultiStat extends React.Component<IProps, any> {
  rootElem: any;

  constructor(props) {
    super(props);
  }

  setRootElemRef(elem) {
    this.rootElem = elem;
  }

  render() {
    const stats = this.props.stats || [];
    let barWidths = _.map(stats, () => null);
    const thresholds = getThresholds(this.props.options.thresholds);
    const colorMap = this.props.options.colors;

    console.log(this.props);
    if (this.rootElem) {
      const rootElemWidth = this.rootElem.clientWidth;
      const values = _.map(stats, 'value');
      const maxVal = _.max(values);
      const minVal = _.min(values);
      const delta = maxVal - minVal;
      const minWidth = rootElemWidth * 0.3;
      const maxWidth = rootElemWidth * 0.9;
      const deltaWidth = maxWidth - minWidth;
      _.forEach(values, (v, i) => {
        let width = (v - minVal) / delta * deltaWidth + minWidth;
        barWidths[i] = Math.max(minWidth, width);
      });
    }

    const statElements = stats.map((stat, index) => {
      const color = getColorForValue(stat.value, thresholds, colorMap);
      return <BarStat key={index} stat={stat} color={color} width={barWidths[index]} />;
    });

    return <div ref={this.setRootElemRef.bind(this)}>{statElements}</div>;
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

react2AngularDirective('multiStat', MultiStat, [
  ['stats', { watchDepth: 'reference' }],
  ['options', { watchDepth: 'reference' }],
]);
