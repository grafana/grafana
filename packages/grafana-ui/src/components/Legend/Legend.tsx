import { DisplayValue } from '@grafana/data';

import { LegendList } from './LegendList';
import { LegendTable } from './LegendTable';
import tinycolor from 'tinycolor2';

export const generateLegendItems = (numberOfSeries: number, statsToDisplay?: DisplayValue[]): LegendItem[] => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');

  return [...new Array(numberOfSeries)].map((item, i) => {
    return {
      label: `${alphabet[i].toUpperCase()}-series`,
      color: tinycolor.fromRatio({ h: i / alphabet.length, s: 1, v: 1 }).toHexString(),
      yAxis: 1,
      displayValues: statsToDisplay || [],
    };
  });
};

export enum LegendDisplayMode {
  List = 'list',
  Table = 'table',
  Hidden = 'hidden',
}
export interface LegendBasicOptions {
  displayMode: LegendDisplayMode;
}

export interface LegendRenderOptions {
  placement: LegendPlacement;
  hideEmpty?: boolean;
  hideZero?: boolean;
}

export type LegendPlacement = 'bottom' | 'right';

export interface LegendOptions extends LegendBasicOptions, LegendRenderOptions {}

export interface LegendItem {
  label: string;
  color: string;
  yAxis: number;
  disabled?: boolean;
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
