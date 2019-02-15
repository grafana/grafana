// Library
import React, { PureComponent } from 'react';

// Utils
import { getValueFormat } from '../../utils';

// Types
import { Themeable, TimeSeriesValue } from '../../types';

export interface Props extends Themeable {
  height: number;
  unit: string;
  width: number;
  value: TimeSeriesValue;
  prefix: string;
  suffix: string;
  maxValue: number;
  minValue: number;
}

export class BarGauge extends PureComponent<Props> {
  static defaultProps = {
    maxValue: 100,
    minValue: 0,
    unit: 'none',
  };

  getNumericValue(): number {
    if (Number.isFinite(this.props.value as number)) {
      return this.props.value as number;
    }
    return 0;
  }

  render() {
    const { height, width, maxValue, minValue, unit } = this.props;

    const numericValue = this.getNumericValue();
    const barMaxHeight = height * 0.8; // 20% for value & name
    const valuePercent = numericValue / (maxValue - minValue);
    const barHeight = valuePercent * barMaxHeight;

    const formatFunc = getValueFormat(unit);
    const valueFormatted = formatFunc(numericValue);

    return (
      <div className="bar-gauge" style={{ width: `${width}px`, height: `${height}px` }}>
        <div className="bar-gauge__value">{valueFormatted}</div>
        <div
          style={{
            height: `${barHeight}px`,
            width: `${width}px`,
            backgroundColor: 'rgba(200,0,0,0.3)',
          }}
        />
      </div>
    );
  }
}
