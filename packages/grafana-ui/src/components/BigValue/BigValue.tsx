// Library
import React, { PureComponent } from 'react';
import { DisplayValue, GraphSeriesValue, DisplayValueAlignmentFactors } from '@grafana/data';

// Types
import { Themeable } from '../../types';
import {
  calculateLayout,
  getPanelStyles,
  getValueAndTitleContainerStyles,
  getValueStyles,
  getTitleStyles,
} from './styles';

import { renderGraph } from './renderGraph';
import { FormattedValueDisplay } from '../FormattedValueDisplay/FormattedValueDisplay';

export interface BigValueSparkline {
  data: GraphSeriesValue[][];
  minX: number;
  maxX: number;
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
    const { value, onClick, className, sparkline } = this.props;

    const layout = calculateLayout(this.props);
    const panelStyles = getPanelStyles(layout);
    const valueAndTitleContainerStyles = getValueAndTitleContainerStyles(layout);
    const valueStyles = getValueStyles(layout);
    const titleStyles = getTitleStyles(layout);

    return (
      <div className={className} style={panelStyles} onClick={onClick}>
        <div style={valueAndTitleContainerStyles}>
          {value.title && <div style={titleStyles}>{value.title}</div>}
          <FormattedValueDisplay value={value} style={valueStyles} />
        </div>
        {renderGraph(layout, sparkline)}
      </div>
    );
  }
}
