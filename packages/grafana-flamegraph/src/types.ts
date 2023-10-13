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

export enum SelectedView {
  TopTable = 'topTable',
  FlameGraph = 'flameGraph',
  Both = 'both',
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
