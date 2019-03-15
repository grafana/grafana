// Library
import React, { PureComponent, CSSProperties, ReactNode } from 'react';
import tinycolor from 'tinycolor2';

// Utils
import { getColorFromHexRgbOrName, getValueFormat, getThresholdForValue } from '../../utils';

// Types
import { Themeable, TimeSeriesValue, Threshold, ValueMapping, VizOrientation } from '../../types';

const BAR_SIZE_RATIO = 0.8;

export interface Props extends Themeable {
  height: number;
  unit: string;
  width: number;
  thresholds: Threshold[];
  valueMappings: ValueMapping[];
  value: TimeSeriesValue;
  maxValue: number;
  minValue: number;
  orientation: VizOrientation;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  displayMode: 'simple' | 'lcd';
}

export class BarGauge extends PureComponent<Props> {
  static defaultProps: Partial<Props> = {
    maxValue: 100,
    minValue: 0,
    value: 100,
    unit: 'none',
    displayMode: 'simple',
    orientation: VizOrientation.Horizontal,
    thresholds: [],
    valueMappings: [],
  };

  render() {
    const { maxValue, minValue, unit, decimals, displayMode } = this.props;

    const numericValue = this.getNumericValue();
    const valuePercent = Math.min(numericValue / (maxValue - minValue), 1);

    const formatFunc = getValueFormat(unit);
    const valueFormatted = formatFunc(numericValue, decimals);

    if (displayMode === 'lcd') {
      return this.renderLcdMode(valueFormatted, valuePercent);
    } else {
      return this.renderSimpleMode(valueFormatted, valuePercent);
    }
  }

  getNumericValue(): number {
    if (Number.isFinite(this.props.value as number)) {
      return this.props.value as number;
    }
    return 0;
  }

  getValueColors(): BarColors {
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

  getValueStyles(value: string, color: string, width: number): CSSProperties {
    const guess = width / (value.length * 1.1);
    const fontSize = Math.min(Math.max(guess, 14), 40);

    return {
      color: color,
      fontSize: fontSize + 'px',
    };
  }

  /*
   * Return width or height depending on viz orientation
   * */
  get size() {
    const { height, width, orientation } = this.props;
    return orientation === VizOrientation.Horizontal ? width : height;
  }

  renderSimpleMode(valueFormatted: string, valuePercent: number): ReactNode {
    const { height, width, orientation } = this.props;

    const maxSize = this.size * BAR_SIZE_RATIO;
    const barSize = Math.max(valuePercent * maxSize, 0);
    const colors = this.getValueColors();
    const valueStyles = this.getValueStyles(valueFormatted, colors.value, this.size - maxSize);

    const containerStyles: CSSProperties = {
      width: `${width}px`,
      height: `${height}px`,
      display: 'flex',
    };

    const barStyles: CSSProperties = {
      backgroundColor: colors.bar,
    };

    // Custom styles for vertical orientation
    if (orientation === VizOrientation.Vertical) {
      containerStyles.flexDirection = 'column';
      containerStyles.justifyContent = 'flex-end';
      barStyles.height = `${barSize}px`;
      barStyles.width = `${width}px`;
      barStyles.borderTop = `1px solid ${colors.border}`;
    } else {
      // Custom styles for horizontal orientation
      containerStyles.flexDirection = 'row-reverse';
      containerStyles.justifyContent = 'flex-end';
      containerStyles.alignItems = 'center';
      barStyles.height = `${height}px`;
      barStyles.width = `${barSize}px`;
      barStyles.marginRight = '10px';
      barStyles.borderRight = `1px solid ${colors.border}`;
    }

    return (
      <div style={containerStyles}>
        <div className="bar-gauge__value" style={valueStyles}>
          {valueFormatted}
        </div>
        <div style={barStyles} />
      </div>
    );
  }

  getCellColor(positionValue: TimeSeriesValue): CellColors {
    const { thresholds, theme, value } = this.props;
    const activeThreshold = getThresholdForValue(thresholds, positionValue);

    if (activeThreshold !== null) {
      const color = getColorFromHexRgbOrName(activeThreshold.color, theme.type);

      // if we are past real value the cell is not "on"
      if (value === null || (positionValue !== null && positionValue > value)) {
        return {
          background: tinycolor(color)
            .setAlpha(0.15)
            .toRgbString(),
          border: 'transparent',
          isLit: false,
        };
      } else {
        return {
          background: tinycolor(color)
            .setAlpha(0.85)
            .toRgbString(),
          backgroundShade: tinycolor(color)
            .setAlpha(0.55)
            .toRgbString(),
          border: tinycolor(color)
            .setAlpha(0.9)
            .toRgbString(),
          isLit: true,
        };
      }
    }

    return {
      background: 'gray',
      border: 'gray',
    };
  }

  renderLcdMode(valueFormatted: string, valuePercent: number): ReactNode {
    const { height, width, maxValue, minValue, orientation } = this.props;

    const valueRange = maxValue - minValue;
    const maxSize = this.size * BAR_SIZE_RATIO;
    const cellSpacing = 5;
    const cellCount = maxSize / 20;
    const cellSize = (maxSize - cellSpacing * cellCount) / cellCount;
    const colors = this.getValueColors();
    const valueStyles = this.getValueStyles(valueFormatted, colors.value, this.size - maxSize);

    const containerStyles: CSSProperties = {
      width: `${width}px`,
      height: `${height}px`,
      display: 'flex',
    };

    if (orientation === VizOrientation.Horizontal) {
      containerStyles.flexDirection = 'row';
      containerStyles.alignItems = 'center';
      valueStyles.marginLeft = '20px';
    } else {
      containerStyles.flexDirection = 'column-reverse';
      containerStyles.alignItems = 'center';
      valueStyles.marginBottom = '20px';
    }

    const cells: JSX.Element[] = [];

    for (let i = 0; i < cellCount; i++) {
      const currentValue = (valueRange / cellCount) * i;
      const cellColor = this.getCellColor(currentValue);
      const cellStyles: CSSProperties = {
        borderRadius: '2px',
      };

      if (cellColor.isLit) {
        cellStyles.boxShadow = `0 0 4px ${cellColor.border}`;
        // cellStyles.border = `1px solid ${cellColor.border}`;
        // cellStyles.background = `${cellColor.backgroundShade}`;
        cellStyles.backgroundImage = `radial-gradient(${cellColor.background} 10%, ${cellColor.backgroundShade})`;
      } else {
        cellStyles.backgroundColor = cellColor.background;
      }

      if (orientation === VizOrientation.Horizontal) {
        cellStyles.width = `${cellSize}px`;
        cellStyles.height = `${height}px`;
        cellStyles.marginRight = `${cellSpacing}px`;
      } else {
        cellStyles.height = `${cellSize}px`;
        cellStyles.width = `${width}px`;
        cellStyles.marginTop = `${cellSpacing}px`;
      }

      cells.push(<div style={cellStyles} />);
    }

    return (
      <div style={containerStyles}>
        {cells}
        <div className="bar-gauge__value" style={valueStyles}>
          {valueFormatted}
        </div>
      </div>
    );
  }
}

interface BarColors {
  value: string;
  bar: string;
  border: string;
}

interface CellColors {
  background: string;
  backgroundShade?: string;
  border: string;
  isLit?: boolean;
}
