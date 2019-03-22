import { ReactNode } from 'react';

export type DisplayValueClicked = () => void;

export interface DisplayValue {
  text: string; // Show in the UI
  numeric: number; // Use isNaN to check if it is a real number
  color?: string; // color based on configs or Threshold
  title?: string;
  fontSize?: string;
  link?: string | DisplayValueClicked; // URL or callback
  linkNewWindow?: boolean; // target _blank
  tooltip?: ReactNode;
}

export interface DecimalInfo {
  decimals: number;
  scaledDecimals: number;
}
