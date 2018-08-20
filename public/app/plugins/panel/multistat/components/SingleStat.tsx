import React from 'react';
import * as Series from 'app/types/series';
import * as MultiStatPanel from '../types';
import { SparkLine } from './SparkLine';
import { getBGColor } from './utils';

const DEFAULT_COLOR = 'rgb(31, 120, 193)';
const BACKGROUND_OPACITY = 0.1;
const LABEL_SIZE_COEF = 0.7;
export const SPARKLINE_HEIGHT = 0.25;

export interface SingleStatProps {
  layout?: MultiStatPanel.PanelLayout;
  width: number;
  height: number;
  label: string;
  value: string;
  color?: string;
  colorValue?: boolean;
  colorBackground?: boolean;
  fontSize?: number;
  labelFontSize?: number;
  labelToTheLeft?: boolean;
  flotpairs?: Series.Flotpair[];
  sparkline?: {
    show?: boolean;
  };
}

export class SingleStat extends React.PureComponent<SingleStatProps> {
  constructor(props) {
    super(props);
  }

  static defaultProps: Partial<SingleStatProps> = {
    color: DEFAULT_COLOR,
    sparkline: {
      show: false,
    },
  };

  render() {
    const {
      width,
      height,
      label,
      value,
      layout,
      colorBackground,
      colorValue,
      color,
      flotpairs,
      labelToTheLeft,
    } = this.props;
    const bgColor = getBGColor(color, BACKGROUND_OPACITY);
    const containerStyle = getContainerStyle(width, height, layout, colorBackground, bgColor);

    const showSparkline = this.props.sparkline && this.props.sparkline.show;
    const horizontalMargin = ((containerStyle.marginLeft as number) || 0) * 2;
    const sparklineProps = getSparklineProps(width, height, horizontalMargin);
    const sparklineHeight = showSparkline ? sparklineProps.size.h : 0;

    const labelFontSize = Math.floor((this.props.labelFontSize || this.props.fontSize) * LABEL_SIZE_COEF);
    const valueFontSize = this.props.fontSize;
    const labelStyle: React.CSSProperties = {
      fontSize: labelFontSize,
    };

    const valueTopOffset = getTopOffset(height, sparklineHeight, labelFontSize, valueFontSize, labelToTheLeft);
    const valueContainerStyle: React.CSSProperties = {
      top: valueTopOffset + 'px',
    };

    const valueStyle = getValueStyle(valueFontSize, colorValue, color);
    const labelContainerStyle = getLabelContainerStyle(
      height,
      labelFontSize,
      valueFontSize,
      valueTopOffset,
      labelToTheLeft,
      sparklineHeight
    );

    return (
      <div className={`multistat-single ${labelToTheLeft ? 'label-left' : ''}`} style={containerStyle}>
        <div className="multistat-label-container" style={labelContainerStyle}>
          <span className="multistat-label" style={labelStyle}>
            {label}
          </span>
        </div>
        <div className="multistat-value-container" style={valueContainerStyle}>
          <span className="singlestat-panel-value multistat-value" style={valueStyle}>
            {value}
          </span>
        </div>
        {showSparkline && <SparkLine color={color} flotpairs={flotpairs} {...sparklineProps} />}
      </div>
    );
  }
}

function getContainerStyle(
  width: number,
  height: number,
  layout: MultiStatPanel.PanelLayout,
  colorBackground: boolean,
  bgColor: string
): React.CSSProperties {
  let containerStyle: React.CSSProperties = {};
  const MARGIN_COEF = 0.05;
  const MAX_MARGIN = 8;
  if (layout === 'vertical') {
    containerStyle.height = height;
    const margin = Math.min(Math.ceil(height * MARGIN_COEF), MAX_MARGIN);
    containerStyle.marginBottom = margin;
  } else {
    containerStyle.width = width;
    const margin = Math.min(Math.ceil(width * MARGIN_COEF), MAX_MARGIN);
    containerStyle.marginLeft = margin / 2;
    containerStyle.marginRight = margin / 2;
  }

  if (colorBackground) {
    containerStyle.background = bgColor;
  }

  return containerStyle;
}

function getLabelContainerStyle(
  height: number,
  labelFontSize: number,
  valueFontSize: number,
  valueTopOffset: number,
  labelToTheLeft: boolean,
  sparklineHeight: number
): React.CSSProperties {
  let labelContainerStyle: React.CSSProperties = {
    lineHeight: labelFontSize + 'px',
  };
  if (labelToTheLeft) {
    const labelTopOffset = Math.floor(valueTopOffset + (valueFontSize - labelFontSize) / 2);
    labelContainerStyle.top = labelTopOffset;
  } else {
    labelContainerStyle.marginTop = (height - sparklineHeight) * 0.02 + 'px';
  }
  return labelContainerStyle;
}

function getValueStyle(valueFontSize, colorValue, color): React.CSSProperties {
  let valueStyle: React.CSSProperties = {
    fontSize: valueFontSize + 'px',
  };
  if (colorValue) {
    valueStyle.color = color;
  }
  return valueStyle;
}

function getSparklineProps(width: number, height: number, margin: number) {
  const sparklinePadding = Math.ceil(width * 0.1);
  const sparklineWidth = width - margin - sparklinePadding;
  const sparklineHeight = Math.ceil(height * SPARKLINE_HEIGHT);
  const size = { w: sparklineWidth, h: sparklineHeight };
  const customClass = 'multistat-sparkline';
  const customStyles = { left: sparklinePadding / 2 };
  return { size, customClass, customStyles };
}

function getTopOffset(height, sparklineHeight, labelFontSize, valueFontSize, labelToTheLeft?) {
  if (labelToTheLeft) {
    return (height - sparklineHeight - valueFontSize) / 2;
  }
  return (height - sparklineHeight - labelFontSize - valueFontSize) / 3;
}
