import { type DisplayValue } from '@grafana/data';

import { type LevelItem } from './FlameGraph/dataTransform';

export type ClickedItemData = {
  posX: number;
  posY: number;
  label: string;
  item: LevelItem;
};

export enum SampleUnit {
  Bytes = 'bytes',
  Short = 'short',
  Nanoseconds = 'ns',
}

export enum ViewMode {
  Single = 'single',
  Split = 'split',
}

export enum PaneView {
  TopTable = 'topTable',
  FlameGraph = 'flameGraph',
  CallTree = 'callTree',
}

export interface TableData {
  self: number;
  total: number;
  // For diff view
  totalRight: number;
}

export enum ColorScheme {
  ValueBased = 'valueBased',
  PackageBased = 'packageBased',
}

export enum ColorSchemeDiff {
  Default = 'default',
  DiffColorBlind = 'diffColorBlind',
}

export type TextAlign = 'left' | 'right';

// 'name' shows the function without the import path. Independent of TextAlign,
// so a name-only label can still be left or right aligned.
export type SymbolLabel = 'full' | 'name';

export interface ProfileTooltipData {
  percentValue: number;
  percentSelf: number;
  unitTitle: string;
  unitValue: string;
  unitSelf: string;
  samples: string | undefined;
}

export interface ProfileTooltipDataOptions {
  displayValue: DisplayValue;
  displaySelf: DisplayValue;
  unitTitle: string;
  totalTicks: number;
  showSamples?: boolean;
}

export interface ProfileValueDataOptions {
  displayValue: DisplayValue;
  totalTicks: number;
}

export interface ProfileValueData {
  unitValue: string;
  percentage: number;
}
