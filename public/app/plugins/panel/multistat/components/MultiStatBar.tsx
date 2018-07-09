import _ from 'lodash';
import React from 'react';
import { BarStat } from './BarStat';
import { MultistatPanelSize, MultistatPanelOptions, MultistatPanelLayout } from '../types';

export interface IProps {
  stats: any[];
  options: MultistatPanelOptions;
  size: MultistatPanelSize;
  getColor: (v: number) => string;
}

export class MultiStatBar extends React.Component<IProps, any> {
  constructor(props) {
    super(props);
  }

  isValuesOutOfBar(barWidths): boolean {
    const minLength = this.props.options.layout === 'vertical' ? 120 : 90;
    const minBarWidth = _.min(barWidths);
    const valuesOutOfBar = minBarWidth < minLength;
    return valuesOutOfBar;
  }

  render() {
    const stats = this.props.stats || [];
    const options = this.props.options;
    let barLengths = _.map(stats, () => null);

    let rootElemLength = options.layout === MultistatPanelLayout.Horizontal ? this.props.size.h : this.props.size.w;
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
    const totalWidth = options.layout === MultistatPanelLayout.Horizontal ? this.props.size.w : this.props.size.h;
    const barWidth = stats.length > 0 ? totalWidth / stats.length : 0;
    const valueOutOfBar = this.isValuesOutOfBar(barLengths);

    let direction: MultistatPanelLayout;
    if (options.layout === MultistatPanelLayout.Vertical) {
      direction = MultistatPanelLayout.Vertical;
    } else {
      direction = MultistatPanelLayout.Horizontal;
    }

    const statElements = stats.map((stat, index) => {
      const color = this.props.getColor(stat.value);
      let barSize;
      let barContainerStyle: React.CSSProperties = {};
      if (direction === MultistatPanelLayout.Horizontal) {
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
}
