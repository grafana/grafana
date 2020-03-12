// Library
import React, { PureComponent } from 'react';
import { DisplayValue, GraphSeriesValue, DisplayValueAlignmentFactors } from '@grafana/data';

// Types
import { Themeable } from '../../types';
import { buildLayout } from './BigValueLayout';
import { FormattedValueDisplay } from '../FormattedValueDisplay/FormattedValueDisplay';

export interface BigValueSparkline {
  data: GraphSeriesValue[][];
  xMin?: number | null;
  xMax?: number | null;
  yMin?: number | null;
  yMax?: number | null;
  highlightIndex?: number;
}

export enum BigValueColorMode {
  Value = 'value',
  Background = 'background',
}

export enum BigValueGraphMode {
  None = 'none',
  Line = 'line',
  Area = 'area',
}

export enum BigValueJustifyMode {
  Auto = 'auto',
  Center = 'center',
}

export interface Props extends Themeable {
  height: number;
  width: number;
  value: DisplayValue;
  sparkline?: BigValueSparkline;
  onClick?: React.MouseEventHandler<HTMLElement>;
  className?: string;
  colorMode: BigValueColorMode;
  graphMode: BigValueGraphMode;
  justifyMode?: BigValueJustifyMode;
  alignmentFactors?: DisplayValueAlignmentFactors;
}

export class BigValue extends PureComponent<Props> {
  static defaultProps: Partial<Props> = {
    justifyMode: BigValueJustifyMode.Auto,
  };

  render() {
    const { value, onClick, className } = this.props;

    const layout = buildLayout(this.props);
    const panelStyles = layout.getPanelStyles();
    const valueAndTitleContainerStyles = layout.getValueAndTitleContainerStyles();
    const valueStyles = layout.getValueStyles();
    const titleStyles = layout.getTitleStyles();

    return (
      <div className={className} style={panelStyles} onClick={onClick}>
        <div style={valueAndTitleContainerStyles}>
          {value.title && <div style={titleStyles}>{value.title}</div>}
          <FormattedValueDisplay value={value} style={valueStyles} />
        </div>
        {layout.renderChart()}
      </div>
    );
  }
}
