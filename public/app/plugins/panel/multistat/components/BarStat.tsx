import React from 'react';
import * as MultiStatPanel from '../types';
import { getBGColor } from './utils';

const DEFAULT_COLOR = 'rgb(31, 120, 193)';
const BAR_WIDTH_FACTOR = 0.8;
const BAR_PADDING = 10;
const VALUE_PADDING_FACTOR = 1.2;

export interface BarStatProps {
  width: number;
  height: number;
  label: string;
  value: string;
  color?: string;
  colorValue?: boolean;
  valueOutOfBar?: boolean;
  direction?: MultiStatPanel.PanelLayout;
  styleLeft?: string | number;
  fontSize?: number;
  valueFontSize?: number;
  verticalLabel?: boolean;
}

export class BarStat extends React.PureComponent<BarStatProps> {
  labelElem: any;
  valueElem: any;
  barElem: any;

  static defaultProps: Partial<BarStatProps> = {
    color: DEFAULT_COLOR,
    colorValue: false,
    valueOutOfBar: false,
  };

  constructor(props) {
    super(props);
  }

  render() {
    const valueColor = this.props.color || DEFAULT_COLOR;
    const bgColor = getBGColor(valueColor);
    const verticalDirection = this.props.direction === 'vertical';
    const { valueOutOfBar, verticalLabel } = this.props;

    let barWidth = 0;
    let valueContainerStyle: React.CSSProperties = {};
    let valueStyle: React.CSSProperties = {};
    let barLabelStyle: React.CSSProperties = {};
    let barStyle: React.CSSProperties = {};
    let barContainerStyle: React.CSSProperties = { left: this.props.styleLeft };

    if (this.props.width && this.props.height) {
      barStyle.background = bgColor;
      if (verticalDirection) {
        barContainerStyle.height = this.props.height;
        barContainerStyle.width = this.props.width;
        barWidth = this.props.height * BAR_WIDTH_FACTOR;
        barStyle.height = barWidth;
        barStyle.width = this.props.width;
        barContainerStyle.lineHeight = `${barWidth}px`;
      } else {
        barWidth = this.props.width * BAR_WIDTH_FACTOR;
        barStyle.width = barWidth;
        barStyle.height = this.props.height - BAR_PADDING;
        barContainerStyle.width = barWidth;
        barContainerStyle.height = this.props.height - BAR_PADDING;
        const valueOffset = this.props.valueFontSize * VALUE_PADDING_FACTOR;
        valueContainerStyle.bottom = valueOutOfBar ? this.props.height + valueOffset : 0;
        valueContainerStyle.width = barWidth;
        if (verticalLabel) {
          barLabelStyle.bottom = this.props.fontSize / 2;
          barLabelStyle.left = (barWidth - this.props.fontSize) / 2;
        } else {
          barLabelStyle.width = barWidth;
        }
      }
    }

    let labelFontSizePx, valueFontSizePx;
    if (this.props.fontSize) {
      labelFontSizePx = this.props.fontSize + 'px';
      valueFontSizePx = this.props.valueFontSize + 'px';
      barLabelStyle.fontSize = labelFontSizePx;
      valueStyle.fontSize = valueFontSizePx;
    }

    if (this.props.colorValue) {
      valueStyle.color = valueColor;
    }

    if (verticalDirection) {
      barStyle.borderRightColor = valueColor;
    } else {
      barStyle.borderTopColor = valueColor;
    }

    const barLabelClassOption = verticalLabel ? 'bar-label--vertical' : 'bar-label--horizontal';
    const barContainerClass = `multistat-bar-container multistat-bar-container--${this.props.direction}`;
    const barValueContainer = verticalDirection ? (
      <span className="bar-value" style={valueStyle} ref={el => (this.valueElem = el)}>
        {this.props.value}
      </span>
    ) : (
      <div className="value-container" style={valueContainerStyle}>
        <span className="bar-value" style={valueStyle} ref={el => (this.valueElem = el)}>
          {this.props.value}
        </span>
      </div>
    );

    return (
      <div className={barContainerClass} style={barContainerStyle}>
        <div className="multistat-bar" style={barStyle} ref={el => (this.barElem = el)}>
          <span className={`bar-label ${barLabelClassOption}`} style={barLabelStyle} ref={el => (this.labelElem = el)}>
            {this.props.label}
          </span>
          {!this.props.valueOutOfBar && barValueContainer}
        </div>
        {this.props.valueOutOfBar && (
          <div className="value-container value-container--out-of-bar" style={valueContainerStyle}>
            <span className="bar-value" style={valueStyle} ref={el => (this.valueElem = el)}>
              {this.props.value}
            </span>
          </div>
        )}
      </div>
    );
  }
}
