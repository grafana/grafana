import { DisplayValue } from '../../types/index';

import { LegendList } from './LegendList';
import { LegendTable } from './LegendTable';

export enum LegendDisplayMode {
  List = 'list',
  Table = 'table',
}
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
  yAxis: number;
  displayValues?: DisplayValue[];
}

export interface LegendComponentProps {
  className?: string;
  items: LegendItem[];
  placement: LegendPlacement;
  // Function to render given item
  itemRenderer?: (item: LegendItem, index: number) => JSX.Element;
}

export interface LegendProps extends LegendComponentProps {}

export { LegendList, LegendTable };
