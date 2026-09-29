import { type LevelItem } from './FlameGraph/dataTransform';

export type ClickedItemData = {
  posX: number;
  posY: number;
  label: string;
  item: LevelItem;
  // Which tree the item was clicked in. Only differs from 'children' for the callers tree of the sandwich view.
  direction?: 'children' | 'parents';
};

export enum SampleUnit {
  Bytes = 'bytes',
  Short = 'short',
  Nanoseconds = 'ns',
}

export enum SelectedView {
  TopTable = 'topTable',
  FlameGraph = 'flameGraph',
  Both = 'both',
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
