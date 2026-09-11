import { type MouseEventHandler } from 'react';

import { type DisplayValue, type DisplayValueAlignmentFactors, type FieldSparkline } from '@grafana/data';
import { type PercentChangeColorMode, type VizTextDisplayOptions } from '@grafana/schema';

import { type Themeable2 } from '../../types/theme';

export enum BigValueColorMode {
  Background = 'background',
  BackgroundSolid = 'background_solid',
  None = 'none',
  Value = 'value',
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

export interface Props extends Themeable2 {
  /** Height of the component */
  height: number;
  /** Width of the component */
  width: number;
  /** Value displayed as Big Value */
  value: DisplayValue;
  /** Sparkline values for showing a graph under/behind the value  */
  sparkline?: FieldSparkline;
  /** onClick handler for the value */
  onClick?: MouseEventHandler<HTMLElement>;
  /** Custom styling */
  className?: string;
  /** Color mode for coloring the value or the background */
  colorMode: BigValueColorMode;
  /** Show a graph behind/under the value */
  graphMode: BigValueGraphMode;
  /** Auto justify value and text or center it */
  justifyMode?: BigValueJustifyMode;
  /** Factors that should influence the positioning of the text  */
  alignmentFactors?: DisplayValueAlignmentFactors;
  /** Explicit font size control */
  text?: VizTextDisplayOptions;
  /** Specify which text should be visible in the BigValue */
  textMode?: BigValueTextMode;
  /** If true disables the tooltip */
  hasLinks?: boolean;
  /** Percent change color mode */
  percentChangeColorMode?: PercentChangeColorMode;

  /**
   * If part of a series of stat panes, this is the total number.
   * Used by BigValueTextMode.Auto text mode.
   */
  count?: number;

  /**
   * Disable the wide layout for the BigValue
   */
  disableWideLayout?: boolean;
}
