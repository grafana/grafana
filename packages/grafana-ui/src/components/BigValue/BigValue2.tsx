// Library
import React, { PureComponent, CSSProperties } from 'react';
import tinycolor from 'tinycolor2';
import { Chart, Geom } from 'bizcharts';
import { DisplayValue } from '@grafana/data';

// Utils
import { getColorFromHexRgbOrName } from '../../utils';

// Types
import { Themeable } from '../../types';

export interface BigValueSparkline {
  data: any[][];
  minX: number;
  maxX: number;
}

export interface Props extends Themeable {
  height: number;
  width: number;
  value: DisplayValue;
  sparkline?: BigValueSparkline;
  onClick?: React.MouseEventHandler<HTMLElement>;
  className?: string;
}

const PANEL_PADDING = 16;

export class BigValue2 extends PureComponent<Props> {
  render() {
    const { height, width, value, onClick, className, theme, sparkline } = this.props;

    const baseColor = getColorFromHexRgbOrName(value.color || 'green', theme.type);
    const panelStyles = getPanelStyles(width, height, baseColor);
    const valueStyles = getValueStyles(this.props);
    const titleStyles = getTitleStyles(this.props);

    return (
      <div className={className} style={panelStyles} onClick={onClick}>
        <div style={valueStyles}>{value.text}</div>
        {value.title && <div style={titleStyles}>{value.title}</div>}
        {sparkline && this.renderChartElement()}
      </div>
    );
  }

  renderChartElement() {
    const { height, width, sparkline } = this.props;

    if (!sparkline) {
      return null;
    }

    // const chartStyles: CSSProperties = {
    //   width: `${width - 20}px`,
    //   height: `${height / 2}px`,
    // };

    const data = sparkline.data.map(values => {
      return { time: values[0], value: values[1] };
    });

    const lineStyle: any = {
      stroke: '#EEE',
      lineWidth: 2,
      shadowBlur: 7,
      shadowColor: '#333',
      shadowOffsetY: 7,
    };

    const chartWidth = width - PANEL_PADDING * 2;
    const chartHeight = height - height / 2;

    return (
      <Chart height={chartHeight} width={chartWidth} data={data} animate={false} padding={[0, 0, 0, 0]}>
        <Geom type="line" position="time*value" size={2} color="white" style={lineStyle} shape="smooth" />
      </Chart>
    );
  }
}

const MIN_VALUE_FONT_SIZE = 15;
const MAX_VALUE_FONT_SIZE = 40;

export function getValueFontSize(width: number, height: number): number {
  const byWidth = width * 0.2;

  return Math.min(Math.max(byWidth, MIN_VALUE_FONT_SIZE), MAX_VALUE_FONT_SIZE);
}

export function getTitleStyles(props: Props) {
  const { height, width } = props;
  const valueFontSize = getValueFontSize(width, height);

  const titleStyles: CSSProperties = {
    fontSize: `${valueFontSize * 0.6}px`,
    color: '#EEE',
  };

  return titleStyles;
}

export function getValueStyles(props: Props) {
  const { height, width } = props;
  const valueFontSize = getValueFontSize(width, height);

  const valueStyles: CSSProperties = {
    fontSize: `${valueFontSize}px`,
    color: 'white',
    lineHeight: 1,
  };

  return valueStyles;
}

export function getPanelStyles(width: number, height: number, baseColor: string) {
  const bgColor2 = tinycolor(baseColor)
    .darken(15)
    .spin(10)
    .toRgbString();
  const bgColor3 = tinycolor(baseColor)
    .lighten(0)
    .spin(-10)
    .toRgbString();

  const panelStyles: CSSProperties = {
    width: `${width}px`,
    height: `${height}px`,
    padding: '16px',
    borderRadius: '3px',
    background: `linear-gradient(120deg, ${bgColor2}, ${bgColor3})`,
  };

  return panelStyles;
}
