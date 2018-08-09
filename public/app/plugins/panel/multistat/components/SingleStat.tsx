import React from 'react';
import * as Series from 'app/types/series';
import * as MultiStatPanel from '../types';
import { SparkLine } from './SparkLine';
import { getBGColor } from './utils';

const DEFAULT_COLOR = 'rgb(31, 120, 193)';
const BACKGROUND_OPACITY = 0.1;
const LABEL_SIZE_COEF = 0.7;
const SPARKLINE_HEIGHT = 0.25;

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
    const { width, height, label, value, layout, colorBackground, colorValue, flotpairs, labelToTheLeft } = this.props;
    const valueColor = this.props.color;
    const bgColor = getBGColor(valueColor, BACKGROUND_OPACITY);

    const showSparkline = this.props.sparkline && this.props.sparkline.show;
    const sparklineWidth = width;
    let sparklineHeight = Math.floor(height * SPARKLINE_HEIGHT);
    sparklineHeight = showSparkline ? sparklineHeight : 0;
    const sparklineSize = { w: sparklineWidth, h: sparklineHeight };

    let containerStyle: React.CSSProperties = {};
    if (layout === 'vertical') {
      containerStyle.height = height;
    } else {
      containerStyle.width = width;
    }

    if (colorBackground) {
      containerStyle.background = bgColor;
    }

    const labelFontSize = Math.floor((this.props.labelFontSize || this.props.fontSize) * LABEL_SIZE_COEF);
    let valueFontSize = this.props.fontSize;
    const labelStyle: React.CSSProperties = {
      fontSize: labelFontSize,
    };
    const labelContainerStyle: React.CSSProperties = {
      lineHeight: labelFontSize + 'px',
    };

    let valueStyle: React.CSSProperties = {
      fontSize: valueFontSize + 'px',
    };
    if (colorValue) {
      valueStyle.color = valueColor;
    }

    const valueTopOffset = getTopOffset(height, sparklineHeight, labelFontSize, valueFontSize, labelToTheLeft);
    const valueTopOffsetPx = valueTopOffset + 'px';
    const valueContainerStyle: React.CSSProperties = {
      top: valueTopOffsetPx,
    };

    if (labelToTheLeft) {
      const labelTopOffset = Math.floor(valueTopOffset + (valueFontSize - labelFontSize) / 2);
      labelContainerStyle.top = labelTopOffset;
    } else {
      labelContainerStyle.marginTop = (height - sparklineHeight) * 0.02 + 'px';
    }

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
        {showSparkline && <SparkLine color={valueColor} size={sparklineSize} flotpairs={flotpairs} />}
      </div>
    );
  }
}

function getTopOffset(height, sparklineHeight, labelFontSize, valueFontSize, labelToTheLeft?) {
  if (labelToTheLeft) {
    return (height - sparklineHeight - valueFontSize) / 2;
  }
  return (height - sparklineHeight - labelFontSize - valueFontSize) / 3;
}
