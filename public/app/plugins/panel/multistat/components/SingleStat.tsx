import React from 'react';
import { SparkLine } from './SparkLine';
import { SeriesStat, MultistatPanelSize, MultistatPanelOptions, MultistatPanelLayout } from '../types';
import { getBGColor } from './utils';

export interface IProps {
  stat: SeriesStat;
  size?: MultistatPanelSize;
  color?: string;
  options?: MultistatPanelOptions;
}

export class SingleStat extends React.Component<IProps, any> {
  constructor(props) {
    super(props);
  }

  render() {
    const stat = this.props.stat;
    const options = this.props.options;
    const valueColor = this.props.color;
    const bgColor = getBGColor(valueColor, 0.1);

    let containerStyle: React.CSSProperties = {};
    if (options.layout === MultistatPanelLayout.Vertical) {
      containerStyle.height = this.props.size.h;
    } else {
      containerStyle.width = this.props.size.w;
    }

    if (options.colorBackground) {
      containerStyle.background = bgColor;
    }

    const { labelFontSizePx, valueFontSize, valueFontSizePx } = getFontSize(this.props.size, this.props.options);
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
    const valueTopOffset = Math.ceil(valueFontSize * 0.6) + 'px';
    const valueContainerStyle: React.CSSProperties = {
      top: valueTopOffset,
    };

    return (
      <div className="multistat-horizontal" style={containerStyle}>
        <div className="multistat-label-container" style={labelContainerStyle}>
          <span className="multistat-label-horizontal" style={labelStyle}>
            {stat.label}
          </span>
        </div>
        <div className="multistat-value-container" style={valueContainerStyle}>
          <span className="singlestat-panel-value multistat-value" style={valueStyle}>
            {stat.valueFormatted}
          </span>
        </div>
        {this.props.options.sparkline.show && (
          <SparkLine stat={stat} options={this.props.options} color={valueColor} size={this.props.size} />
        )}
      </div>
    );
  }
}

function getFontSize(panelSize: MultistatPanelSize, options?) {
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
