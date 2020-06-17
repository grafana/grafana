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

/**
 * Options for how the value & title are to be displayed
 */
export enum BigValueNameAndValueOption {
  Auto = 'auto',
  Value = 'value',
  ValueAndName = 'value_and_value',
  Name = 'name',
  None = 'none',
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
  nameAndValue?: BigValueNameAndValueOption;
}

export class BigValue extends PureComponent<Props> {
  static defaultProps: Partial<Props> = {
    justifyMode: BigValueJustifyMode.Auto,
  };

  render() {
    const { onClick, className } = this.props;

    const layout = buildLayout(this.props);
    const panelStyles = layout.getPanelStyles();
    const valueAndTitleContainerStyles = layout.getValueAndTitleContainerStyles();
    const valueStyles = layout.getValueStyles();
    const titleStyles = layout.getTitleStyles();
    const displayValue = layout.displayValue;

    return (
      <div className={className} style={panelStyles} onClick={onClick}>
        <div style={valueAndTitleContainerStyles}>
          {displayValue.title && <div style={titleStyles}>{displayValue.title}</div>}
          <FormattedValueDisplay value={displayValue} style={valueStyles} />
        </div>
        {layout.renderChart()}
      </div>
    );
  }
}
