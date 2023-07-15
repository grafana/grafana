import { LevelItem } from './FlameGraph/dataTransform';

export type ClickedItemData = {
  posX: number;
  posY: number;
  label: string;
  item: LevelItem;
  level: number;
};

export enum SampleUnit {
  Bytes = 'bytes',
  Short = 'short',
  Nanoseconds = 'ns',
}

export enum ColumnTypes {
  Symbol = 'Symbol',
  Self = 'Self',
  Total = 'Total',
}

export enum SelectedView {
  TopTable = 'topTable',
  FlameGraph = 'flameGraph',
  Both = 'both',
}

export interface TableData {
  self: number;
  total: number;
}

export interface TopTableData {
  symbol: string;
  self: TopTableValue;
  total: TopTableValue;
}

export type TopTableValue = {
  value: number;
  unitValue: string;
};

export enum ColorScheme {
  ValueBased = 'valueBased',
  PackageBased = 'packageBased',
}

export type TextAlign = 'left' | 'right';
