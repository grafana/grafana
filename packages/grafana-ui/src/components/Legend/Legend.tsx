import React from 'react';

import { StatID } from '../../utils/statsCalculator';
import { DisplayValue } from '../../types/index';

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

export interface LegendOptions extends LegendBasicOptions, LegendRenderOptions {
  stats?: StatID[];
  decimals?: number;
}

export interface StatDisplayValue extends DisplayValue {
  statId: string;
}

export interface LegendItem {
  label: string;
  color: string;
  isVisible: boolean;
  useRightYAxis: boolean;
  stats: StatDisplayValue[];
}

export interface LegendComponentProps {
  items: LegendItem[];
  // Array of stat ids to be displayed in legend
  statsToDisplay?: string[];
  // Function to render given item
  itemRenderer?: (item: LegendItem) => JSX.Element;
  onToggleSort?: (sortBy: string, sortDesc: boolean) => void;
}

export interface LegendProps extends LegendComponentProps {
  // Component to be used to render legend
  renderLegendAs: React.ComponentType<LegendComponentProps>;
}

export const Legend: React.FunctionComponent<LegendProps> = ({ renderLegendAs, ...legendComponentProps }) => {
  const LegendComponent = renderLegendAs;

  return <LegendComponent {...legendComponentProps} />;
};

Legend.displayName = 'Legend';
