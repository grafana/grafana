import React from 'react';
import * as Series from 'app/types/series';
import * as MultiStatPanel from '../types';
import { SparkLine } from './SparkLine';
import { getBGColor } from './utils';

const DEFAULT_COLOR = 'rgb(31, 120, 193)';

export interface SingleStatProps {
  width: number;
  height: number;
  label: string;
  value: string;
  color?: string;
  layout?: MultiStatPanel.PanelLayout;
  colorValue?: boolean;
  colorBackground?: boolean;
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
    const { label, value, layout, colorBackground, colorValue, flotpairs } = this.props;
    const valueColor = this.props.color;
    const bgColor = getBGColor(valueColor, 0.1);

    const showSparkline = this.props.sparkline && this.props.sparkline.show;
    const sparklineWidth = this.props.width;
    let sparklineHeight = Math.floor(this.props.height * 0.25);
    sparklineHeight = showSparkline ? sparklineHeight : 0;
    const sparklineSize = { w: sparklineWidth, h: sparklineHeight };

    const widthRatio = this.props.width / (this.props.height - sparklineHeight);
    const labelToTheLeft = widthRatio > 3;

    let containerStyle: React.CSSProperties = {};
    if (layout === 'vertical') {
      containerStyle.height = this.props.height;
    } else {
      containerStyle.width = this.props.width;
    }

    if (colorBackground) {
      containerStyle.background = bgColor;
    }

    const { labelFontSize, labelFontSizePx, valueFontSize, valueFontSizePx } = getFontSize(
      this.props.width,
      this.props.height,
      showSparkline
    );
    const labelStyle: React.CSSProperties = {
      fontSize: labelFontSizePx,
    };
    const labelContainerStyle: React.CSSProperties = {
      lineHeight: labelFontSizePx,
    };

    let valueStyle: React.CSSProperties = {
      fontSize: valueFontSizePx,
    };
    if (colorValue) {
      valueStyle.color = valueColor;
    }

    const valueTopOffset = getTopOffset(
      this.props.height,
      sparklineHeight,
      labelFontSize,
      valueFontSize,
      labelToTheLeft
    );
    const valueTopOffsetPx = valueTopOffset + 'px';
    const valueContainerStyle: React.CSSProperties = {
      top: valueTopOffsetPx,
    };

    if (labelToTheLeft) {
      const labelTopOffset = Math.floor(valueTopOffset + (valueFontSize - labelFontSize) / 2);
      containerStyle.display = 'flex';
      labelContainerStyle.flexGrow = 1;
      valueContainerStyle.flexGrow = 2;
      labelContainerStyle.position = 'relative';
      labelContainerStyle.top = labelTopOffset;
      labelContainerStyle.lineHeight = 'unset';
      labelStyle.fontSize = labelFontSize * 1.5 + 'px';
      labelStyle.verticalAlign = 'top';
    }

    return (
      <div className="multistat-single" style={containerStyle}>
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

function getFontSize(panelWidth: number, panelHeight: number, showSparkline?) {
  const size = Math.min(panelHeight, panelWidth * 0.75);
  let increaseRatio = 1;
  if (!showSparkline) {
    increaseRatio = 1.2;
  }

  const labelFontSize = Math.ceil(size / 10 * increaseRatio);
  const valueFontSize = Math.ceil(size / 4 * increaseRatio);
  const labelFontSizePx = labelFontSize + 'px';
  const valueFontSizePx = valueFontSize + 'px';

  return { labelFontSize, valueFontSize, labelFontSizePx, valueFontSizePx };
}

function getTopOffset(height, sparklineHeight, labelFontSize, valueFontSize, labelToTheLeft?) {
  if (labelToTheLeft) {
    return (height - sparklineHeight - valueFontSize) / 2;
  }
  return (height - sparklineHeight - labelFontSize * 2 * 1.25 - valueFontSize) / 2;
}
