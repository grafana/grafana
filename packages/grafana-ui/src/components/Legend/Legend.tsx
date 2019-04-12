import React from 'react';

import { DisplayValue } from '../../types/index';
import { LegendList } from './LegendList';

export interface LegendBasicOptions {
  isVisible: boolean;
  asTable: boolean;
}

export interface LegendRenderOptions {
  placement: LegendPlacement;
  hideEmpty?: boolean;
  hideZero?: boolean;
}

export type LegendPlacement = 'under' | 'right' | 'over'; // Over used by piechart

export interface LegendOptions extends LegendBasicOptions, LegendRenderOptions {}

export interface LegendItem {
  label: string;
  color: string;
  isVisible: boolean;
  useRightYAxis: boolean;
  info?: DisplayValue[];
}

export interface LegendComponentProps {
  items: LegendItem[];
  // Array of stat ids to be displayed in legend
  statsToDisplay?: string[];
  placement: LegendPlacement;
  // Function to render given item
  itemRenderer?: (item: LegendItem) => JSX.Element;
  // onToggleSort?: (sortBy: string, sortDesc: boolean) => void;
}

export interface LegendProps extends LegendComponentProps {
  // Component to be used to render legend
  // renderLegendAs: React.ComponentType<LegendComponentProps>;
}

export const Legend: React.FunctionComponent<LegendProps> = ({ ...legendComponentProps }) => {
  // const LegendComponent = renderLegendAs;

  return <LegendList {...legendComponentProps} />;
};

Legend.displayName = 'Legend';
