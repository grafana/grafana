import { DataQuery } from '@grafana/ui';

export enum ResolutionSelection {
  range = 'range',
  interval = 'interval',
}

export interface QueriesForResolution {
  txt?: string;
  ms: number; // Will be -Infinity when resolution is not set
  targets: DataQuery[]; // Always mixed
}

export interface MultiResolutionQuery extends DataQuery {
  live?: DataQuery; // Will get passed existing panel data
  select: ResolutionSelection;
  resolutions: QueriesForResolution[];
}
