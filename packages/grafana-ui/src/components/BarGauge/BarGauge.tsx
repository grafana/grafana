// Library
import React, { PureComponent } from 'react';
import tinycolor from 'tinycolor2';

// Utils
import { getColorFromHexRgbOrName, getValueFormat, getThresholdForValue } from '../../utils';

// Types
import { Themeable, TimeSeriesValue, Threshold, ValueMapping } from '../../types';

export interface Props extends Themeable {
  height: number;
  unit: string;
  width: number;
  thresholds: Threshold[];
  valueMappings: ValueMapping[];
  value: TimeSeriesValue;
  maxValue: number;
  minValue: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export class BarGauge extends PureComponent<Props> {
  static defaultProps: Partial<Props> = {
    maxValue: 100,
    minValue: 0,
    value: 100,
    unit: 'none',
    thresholds: [],
    valueMappings: [],
  };

  getNumericValue(): number {
    if (Number.isFinite(this.props.value as number)) {
      return this.props.value as number;
    }
    return 0;
  }

  getColors(): BarColors {
    const { thresholds, theme, value } = this.props;

    const activeThreshold = getThresholdForValue(thresholds, value);

    if (activeThreshold !== null) {
      const color = getColorFromHexRgbOrName(activeThreshold.color, theme.type);

      return {
        value: color,
        border: color,
        bar: tinycolor(color)
          .setAlpha(0.3)
          .toRgbString(),
      };
    }

    return {
      value: getColorFromHexRgbOrName('gray', theme.type),
      bar: getColorFromHexRgbOrName('gray', theme.type),
      border: getColorFromHexRgbOrName('gray', theme.type),
    };
  }

  getValueStyles(value: string, color: string) {
    const { width } = this.props;

    const guess = width / value.length;
    const fontSize = Math.min(Math.max(guess, 14), 40);

    return {
      color: color,
      fontSize: fontSize + 'px',
    };
  }

  render() {
    const { height, width, maxValue, minValue, unit, decimals } = this.props;

    const numericValue = this.getNumericValue();
    const barMaxHeight = height * 0.8; // 20% for value & name
    const valuePercent = numericValue / (maxValue - minValue);
    const barHeight = Math.max(valuePercent * barMaxHeight, 0);

    const formatFunc = getValueFormat(unit);
    const valueFormatted = formatFunc(numericValue, decimals);
    const colors = this.getColors();

    const containerStyles = { width: `${width}px`, height: `${height}px` };
    const valueStyles = this.getValueStyles(valueFormatted, colors.value);
    const barStyles = {
      height: `${barHeight}px`,
      width: `${width}px`,
      backgroundColor: colors.bar,
      borderTop: `1px solid ${colors.border}`,
    };

    return (
      <div className="bar-gauge" style={containerStyles}>
        <div className="bar-gauge__value" style={valueStyles}>
          {valueFormatted}
        </div>
        <div style={barStyles} />
      </div>
    );
  }
}

interface BarColors {
  value: string;
  bar: string;
  border: string;
}
