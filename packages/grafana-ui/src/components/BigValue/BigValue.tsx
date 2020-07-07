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
export enum BigValueTextMode {
  Auto = 'auto',
  Value = 'value',
  ValueAndName = 'value_and_name',
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
  textMode?: BigValueTextMode;

  /**
   * If part of a series of stat panes, this is the total number.
   * Used by BigValueTextMode.Auto text mode.
   */
  count?: number;
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
    const textValues = layout.textValues;

    return (
      <div className={className} style={panelStyles} onClick={onClick} title={textValues.tooltip}>
        <div style={valueAndTitleContainerStyles}>
          {textValues.title && <div style={titleStyles}>{textValues.title}</div>}
          <FormattedValueDisplay value={textValues} style={valueStyles} />
        </div>
        {layout.renderChart()}
      </div>
    );
  }
}
