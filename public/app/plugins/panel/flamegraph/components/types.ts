export type TooltipData = {
  name: string;
  percentValue: number;
  percentSelf: number;
  unitTitle: string;
  unitValue: string;
  unitSelf: string;
  samples: string;
};

export type Metadata = {
  percentValue: number;
  unitTitle: string;
  unitValue: string;
  samples: string;
};

export type ContextMenuEvent = {
  e: MouseEvent;
  levelIndex: number;
  barIndex: number;
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
