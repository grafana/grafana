import React from 'react';
import * as Series from 'app/types/series';
import * as MultiStatPanel from '../types';
import { SparkLine } from './SparkLine';
import { getBGColor } from './utils';

const DEFAULT_COLOR = 'rgb(31, 120, 193)';

export interface Props {
  stat: Series.SeriesStat;
  size: MultiStatPanel.PanelSize;
  color?: string;
  options?: MultiStatPanel.PanelOptions;
}

export class SingleStat extends React.Component<Props> {
  constructor(props) {
    super(props);
  }

  static defaultProps: Partial<Props> = {
    color: DEFAULT_COLOR,
    options: {},
  };

  render() {
    const stat = this.props.stat;
    const options = this.props.options;
    const valueColor = this.props.color;
    const bgColor = getBGColor(valueColor, 0.1);

    const showSparkline = this.props.options.sparkline && this.props.options.sparkline.show;
    const sparklineWidth = this.props.size.w;
    let sparklineHeight = Math.floor(this.props.size.h * 0.25);
    sparklineHeight = showSparkline ? sparklineHeight : 0;
    const sparklineSize = { w: sparklineWidth, h: sparklineHeight };

    const widthRatio = this.props.size.w / (this.props.size.h - sparklineHeight);
    const labelToTheLeft = widthRatio > 3;

    let containerStyle: React.CSSProperties = {};
    if (options.layout === 'vertical') {
      containerStyle.height = this.props.size.h;
    } else {
      containerStyle.width = this.props.size.w;
    }

    if (options.colorBackground) {
      containerStyle.background = bgColor;
    }

    const { labelFontSize, labelFontSizePx, valueFontSize, valueFontSizePx } = getFontSize(
      this.props.size,
      this.props.options
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
    if (this.props.options.colorValue) {
      valueStyle.color = valueColor;
    }

    const valueTopOffset = getTopOffset(
      this.props.size.h,
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
            {stat.label}
          </span>
        </div>
        <div className="multistat-value-container" style={valueContainerStyle}>
          <span className="singlestat-panel-value multistat-value" style={valueStyle}>
            {stat.valueFormatted}
          </span>
        </div>
        {this.props.options.sparkline.show && (
          <SparkLine stat={stat} options={this.props.options} color={valueColor} size={sparklineSize} />
        )}
      </div>
    );
  }
}

function getFontSize(panelSize: MultiStatPanel.PanelSize, options?) {
  const size = Math.min(panelSize.h, panelSize.w * 0.75);
  let increaseRatio = 1;
  if (!(options && options.sparkline && options.sparkline.show)) {
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
