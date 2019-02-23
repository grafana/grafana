// Library
import React, { PureComponent, CSSProperties } from 'react';
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
  orientation: string;
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
    orientation: 'horizontal',
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

  getValueStyles(value: string, color: string): CSSProperties {
    const { width } = this.props;

    const guess = width / value.length;
    const fontSize = Math.min(Math.max(guess, 14), 40);

    return {
      color: color,
      fontSize: fontSize + 'px',
    };
  }

  renderVerticalBar(valueFormatted: string, valuePercent: number) {
    const { height, width } = this.props;

    const maxHeight = width * 0.8;
    const barHeight = Math.max(valuePercent * maxHeight, 0);
    const colors = this.getColors();
    const valueStyles = this.getValueStyles(valueFormatted, colors.value);

    const containerStyles: CSSProperties = {
      width: `${width}px`,
      height: `${height}px`,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
    };

    const barStyles: CSSProperties = {
      height: `${barHeight}px`,
      width: `${width}px`,
      backgroundColor: colors.bar,
      borderTop: `1px solid ${colors.border}`,
    };

    return (
      <div style={containerStyles}>
        <div className="bar-gauge__value" style={valueStyles}>
          {valueFormatted}
        </div>
        <div style={barStyles} />
      </div>
    );
  }

  renderHorizontalBar(valueFormatted: string, valuePercent: number) {
    const { height, width } = this.props;

    const maxWidth = width - 0.8;
    const barWidth = Math.max(valuePercent * maxWidth, 0);
    const colors = this.getColors();
    const valueStyles = this.getValueStyles(valueFormatted, colors.value);

    valueStyles.marginLeft = '8px';

    const containerStyles: CSSProperties = {
      width: `${width}px`,
      height: `${height}px`,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: '8px',
    };

    const barStyles = {
      height: `${height}px`,
      width: `${barWidth}px`,
      backgroundColor: colors.bar,
      borderRight: `1px solid ${colors.border}`,
    };

    return (
      <div style={containerStyles}>
        <div style={barStyles} />
        <div className="bar-gauge__value" style={valueStyles}>
          {valueFormatted}
        </div>
      </div>
    );
  }

  render() {
    const { maxValue, minValue, orientation, unit, decimals } = this.props;

    const numericValue = this.getNumericValue();
    const valuePercent = numericValue / (maxValue - minValue);

    const formatFunc = getValueFormat(unit);
    const valueFormatted = formatFunc(numericValue, decimals);
    const vertical = orientation === 'vertical';

    return vertical
      ? this.renderVerticalBar(valueFormatted, valuePercent)
      : this.renderHorizontalBar(valueFormatted, valuePercent);
  }
}

interface BarColors {
  value: string;
  bar: string;
  border: string;
}
