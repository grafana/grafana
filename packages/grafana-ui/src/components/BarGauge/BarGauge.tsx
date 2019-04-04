// Library
import React, { PureComponent, CSSProperties, ReactNode } from 'react';
import tinycolor from 'tinycolor2';

// Utils
import { getColorFromHexRgbOrName, getThresholdForValue } from '../../utils';

// Types
import { DisplayValue, Themeable, TimeSeriesValue, Threshold, VizOrientation } from '../../types';

const BAR_SIZE_RATIO = 0.8;
const MIN_VALUE_HEIGHT = 18;
const MAX_VALUE_HEIGHT = 50;
const MIN_VALUE_WIDTH = 50;
const MAX_VALUE_WIDTH = 100;
const LINE_HEIGHT = 1.5;

export interface Props extends Themeable {
  height: number;
  width: number;
  thresholds: Threshold[];
  value: DisplayValue;
  maxValue: number;
  minValue: number;
  orientation: VizOrientation;
  displayMode: 'basic' | 'lcd' | 'gradient';
}

// let canvasElement: HTMLCanvasElement | null = null;
//
// interface TextDimensions {
//   width: number;
//   height: number;
// }
//
// /**
//  * Uses canvas.measureText to compute and return the width of the given text of given font in pixels.
//  *
//  * @param {String} text The text to be rendered.
//  * @param {String} font The css font descriptor that text is to be rendered with (e.g. "bold 14px verdana").
//  *
//  * @see https://stackoverflow.com/questions/118241/calculate-text-width-with-javascript/21015393#21015393
//  */
// function getTextWidth(text: string): number {
//   // re-use canvas object for better performance
//   canvasElement = canvasElement || document.createElement('canvas');
//   const context = canvasElement.getContext('2d');
//   if (context) {
//     context.font = 'normal 16px Roboto';
//     const metrics = context.measureText(text);
//     return metrics.width;
//   }
//   return 16;
// }

export class BarGauge extends PureComponent<Props> {
  static defaultProps: Partial<Props> = {
    maxValue: 100,
    minValue: 0,
    value: {
      text: '100',
      numeric: 100,
    },
    displayMode: 'lcd',
    orientation: VizOrientation.Horizontal,
    thresholds: [],
  };

  render() {
    const { title } = this.props.value;

    if (!title) {
      return this.renderBarAndValue();
    }

    const titleWrapperStyles: CSSProperties = {
      display: 'flex',
      overflow: 'hidden',
    };

    const titleDim = this.calculateTitleDimensions();
    const titleStyles: CSSProperties = {
      fontSize: `${titleDim.fontSize}px`,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      width: '100%',
      alignItems: 'center',
      alignSelf: 'center',
    };

    if (this.isVertical) {
      titleWrapperStyles.flexDirection = 'column-reverse';
      titleStyles.textAlign = 'center';
    } else {
      if (titleDim.placement === 'above') {
        titleWrapperStyles.flexDirection = 'column';
      } else {
        titleWrapperStyles.flexDirection = 'row';
        titleStyles.width = `${titleDim.width}px`;
        titleStyles.textAlign = 'right';
        titleStyles.marginRight = '5px';
      }
    }

    return (
      <div style={titleWrapperStyles}>
        <div style={titleStyles}>{title}</div>
        {this.renderBarAndValue()}
      </div>
    );
  }

  renderBarAndValue() {
    switch (this.props.displayMode) {
      case 'lcd':
        return this.renderRetroBars();
      case 'basic':
      case 'gradient':
      default:
        return this.renderBasicAndGradientBars();
    }
  }

  getValueColors(): BarColors {
    const { thresholds, theme, value } = this.props;

    const activeThreshold = getThresholdForValue(thresholds, value.numeric);

    if (activeThreshold !== null) {
      const color = getColorFromHexRgbOrName(activeThreshold.color, theme.type);

      return {
        value: color,
        border: color,
        background: tinycolor(color)
          .setAlpha(0.25)
          .toRgbString(),
      };
    }

    return {
      value: getColorFromHexRgbOrName('gray', theme.type),
      background: getColorFromHexRgbOrName('gray', theme.type),
      border: getColorFromHexRgbOrName('gray', theme.type),
    };
  }

  getValueStyles(value: string, color: string, width: number, height: number): CSSProperties {
    const heightFont = height / LINE_HEIGHT;
    const guess = width / (value.length * 1.1);
    const fontSize = Math.min(Math.max(guess, 14), heightFont);

    return {
      color: color,
      fontSize: fontSize + 'px',
    };
  }

  /*
   * Return width or height depending on viz orientation
   * */
  get size() {
    const { height, width } = this.props;
    return this.isVertical ? height : width;
  }

  get isVertical() {
    return this.props.orientation === VizOrientation.Vertical;
  }

  calculateTitleDimensions(): TitleDimensions {
    const { title } = this.props.value;
    const { height, width } = this.props;

    if (!title) {
      return { fontSize: 0, width: 0, height: 0, placement: 'above' };
    }

    if (this.isVertical) {
      return {
        fontSize: 16,
        width: width,
        height: 16 * LINE_HEIGHT,
        placement: 'below',
      };
    }

    // if below 40 put text to left
    if (height > 40) {
      const maxTitleHeightRatio = 0.35;
      const titleHeight = Math.max(Math.min(height * maxTitleHeightRatio, MAX_VALUE_HEIGHT), 17);
      return {
        fontSize: titleHeight / LINE_HEIGHT,
        width: 0,
        height: titleHeight,
        placement: 'above',
      };
    } else {
      // title to left of bar scenario
      const maxTitleHeightRatio = 0.5;
      const maxTitleWidthRatio = 0.3;
      const titleHeight = Math.max(height * maxTitleHeightRatio, MIN_VALUE_HEIGHT);

      return {
        fontSize: titleHeight / LINE_HEIGHT,
        height: 0,
        width: Math.max(Math.min(width * maxTitleWidthRatio, 100), 200),
        placement: 'left',
      };
    }
  }

  getBarGradient(maxSize: number): string {
    const { minValue, maxValue, thresholds, value } = this.props;
    const cssDirection = this.isVertical ? '0deg' : '90deg';

    let gradient = '';
    let lastpos = 0;

    for (let i = 0; i < thresholds.length; i++) {
      const threshold = thresholds[i];
      const color = getColorFromHexRgbOrName(threshold.color);
      const valuePercent = Math.min(threshold.value / (maxValue - minValue), 1);
      const pos = valuePercent * maxSize;
      const offset = Math.round(pos - (pos - lastpos) / 2);

      if (gradient === '') {
        gradient = `linear-gradient(${cssDirection}, ${color}, ${color}`;
      } else if (value.numeric < threshold.value) {
        break;
      } else {
        lastpos = pos;
        gradient += ` ${offset}px, ${color}`;
      }
    }

    return gradient + ')';
  }

  renderBasicAndGradientBars(): ReactNode {
    const { height, width, displayMode, maxValue, minValue, value } = this.props;

    const valuePercent = Math.min(value.numeric / (maxValue - minValue), 1);
    const titleDim = this.calculateTitleDimensions();

    let maxBarHeight = 0;
    let maxBarWidth = 0;
    let maxValueHeight = 0;
    let maxValueWidth = 0;

    if (this.isVertical) {
      maxValueHeight = Math.min(Math.max(height * 0.1, MIN_VALUE_HEIGHT), MAX_VALUE_HEIGHT);
      maxValueWidth = width;
      maxBarHeight = height - (titleDim.height + maxValueHeight);
      maxBarWidth = width;
    } else {
      maxValueHeight = height - titleDim.height;
      maxValueWidth = Math.min(Math.max(width * 0.2, MIN_VALUE_WIDTH), MAX_VALUE_WIDTH);
      maxBarHeight = height - titleDim.height;
      maxBarWidth = width - maxValueWidth - titleDim.width;
    }

    console.log('height', height);
    console.log('width', width);
    console.log('titleDim', titleDim);
    console.log('maxBarHeight', maxBarHeight);
    console.log('maxBarWidth', maxBarWidth);
    console.log('maxValueHeight', maxValueHeight);
    console.log('maxValueWidth', maxValueWidth);
    console.log('valuePercent', valuePercent);

    const colors = this.getValueColors();
    const valueStyles = this.getValueStyles(value.text, colors.value, maxValueWidth, maxValueHeight);
    const isBasic = displayMode === 'basic';

    const containerStyles: CSSProperties = {
      display: 'flex',
    };

    const barStyles: CSSProperties = {
      borderRadius: '3px',
    };

    if (this.isVertical) {
      const barHeight = Math.max(valuePercent * maxBarHeight, 1);

      // Custom styles for vertical orientation
      containerStyles.flexDirection = 'column';
      containerStyles.justifyContent = 'flex-end';
      barStyles.transition = 'height 1s';
      barStyles.height = `${barHeight}px`;
      barStyles.width = `${maxBarWidth}px`;
      if (isBasic) {
        // Basic styles
        barStyles.background = `${colors.background}`;
        barStyles.borderTop = `2px solid ${colors.border}`;
      } else {
        // Gradient styles
        barStyles.background = this.getBarGradient(maxBarHeight);
      }
    } else {
      const barWidth = Math.max(valuePercent * maxBarWidth, 1);

      // Custom styles for horizontal orientation
      containerStyles.flexDirection = 'row-reverse';
      containerStyles.justifyContent = 'flex-end';
      containerStyles.alignItems = 'center';
      barStyles.transition = 'width 1s';
      barStyles.height = `${maxBarHeight}px`;
      barStyles.width = `${barWidth}px`;
      barStyles.marginRight = '10px';

      if (isBasic) {
        // Basic styles
        barStyles.background = `${colors.background}`;
        barStyles.borderRight = `2px solid ${colors.border}`;
      } else {
        // Gradient styles
        barStyles.background = this.getBarGradient(maxBarWidth);
      }
    }

    return (
      <div style={containerStyles}>
        <div className="bar-gauge__value" style={valueStyles}>
          {value.text}
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
      if (value === null || (positionValue !== null && positionValue > value.numeric)) {
        return {
          background: tinycolor(color)
            .setAlpha(0.18)
            .toRgbString(),
          border: 'transparent',
          isLit: false,
        };
      } else {
        return {
          background: tinycolor(color)
            .setAlpha(0.95)
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

  renderRetroBars(): ReactNode {
    const { height, width, maxValue, minValue, value } = this.props;

    const valueRange = maxValue - minValue;
    const maxSize = this.size * BAR_SIZE_RATIO;
    const cellSpacing = 5;
    const cellCount = maxSize / 20;
    const cellSize = (maxSize - cellSpacing * cellCount) / cellCount;
    const colors = this.getValueColors();
    const spaceForText = this.isVertical ? width : Math.min(this.size - maxSize, height);
    const valueStyles = this.getValueStyles(value.text, colors.value, spaceForText, 30);

    const containerStyles: CSSProperties = {
      width: `${width}px`,
      height: `${height}px`,
      display: 'flex',
    };

    if (this.isVertical) {
      containerStyles.flexDirection = 'column-reverse';
      containerStyles.alignItems = 'center';
      valueStyles.marginBottom = '20px';
    } else {
      containerStyles.flexDirection = 'row';
      containerStyles.alignItems = 'center';
      valueStyles.marginLeft = '20px';
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
        cellStyles.backgroundImage = `radial-gradient(${cellColor.background} 10%, ${cellColor.backgroundShade})`;
      } else {
        cellStyles.backgroundColor = cellColor.background;
      }

      if (this.isVertical) {
        cellStyles.height = `${cellSize}px`;
        cellStyles.width = `${width}px`;
        cellStyles.marginTop = `${cellSpacing}px`;
      } else {
        cellStyles.width = `${cellSize}px`;
        cellStyles.height = `${height}px`;
        cellStyles.marginRight = `${cellSpacing}px`;
      }

      cells.push(<div key={i.toString()} style={cellStyles} />);
    }

    return (
      <div style={containerStyles}>
        {cells}
        <div className="bar-gauge__value" style={valueStyles}>
          {value.text}
        </div>
      </div>
    );
  }
}

interface BarColors {
  value: string;
  background: string;
  border: string;
}

interface CellColors {
  background: string;
  backgroundShade?: string;
  border: string;
  isLit?: boolean;
}

interface TitleDimensions {
  fontSize: number;
  placement: 'above' | 'left' | 'below';
  width: number;
  height: number;
}
