// Library
import React, { PureComponent, CSSProperties } from 'react';
import tinycolor from 'tinycolor2';
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

export class BigValue2 extends PureComponent<Props> {
  render() {
    const { height, width, value, onClick, className, theme } = this.props;

    const baseColor = getColorFromHexRgbOrName(value.color || 'green', theme.type);
    const panelStyles = getPanelStyles(width, height, baseColor);
    const valueStyles = getValueStyles(this.props);
    const titleStyles = getTitleStyles(this.props);

    return (
      <div className={className} style={panelStyles} onClick={onClick}>
        <div style={valueStyles}>{value.text}</div>
        {value.title && <div style={titleStyles}>{value.title}</div>}
      </div>
    );
  }
}

export function getFontScale(length: number): number {
  if (length > 12) {
    return (length * 5) / 110;
  }
  return (length * 5) / 101;
}

export function getTitleStyles(props: Props) {
  // const { height, width, value } = this.props;

  const titleStyles: CSSProperties = {
    fontSize: '22px',
    color: '#EEE',
  };

  return titleStyles;
}

export function getValueStyles(props: Props) {
  // const { height, width, value } = this.props;

  const valueStyles: CSSProperties = {
    fontSize: '40px',
    color: 'white',
  };

  return valueStyles;
}

export function getPanelStyles(width: number, height: number, baseColor: string) {
  const bgColor2 = tinycolor(baseColor)
    .darken(10)
    .spin(10)
    .toRgbString();
  const bgColor3 = tinycolor(baseColor)
    .lighten(10)
    .spin(-10)
    .toRgbString();

  const panelStyles: CSSProperties = {
    width: `${width}px`,
    height: `${height}px`,
    padding: '16px',
    background: `linear-gradient(90deg, ${bgColor2}, ${bgColor3})`,
  };

  return panelStyles;
}
