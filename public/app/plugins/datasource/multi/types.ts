import { DataQuery } from '@grafana/ui';

export enum ResolutionSelection {
  range = 'range',
  interval = 'interval',
}

export interface QueriesForResolution {
  id: string; // Unique ID
  ms: number; // First value will be 0
  now?: boolean; // only if to=now
  targets: DataQuery[]; // Always mixed
}

export interface MultiResolutionQuery extends DataQuery {
  live?: DataQuery; // Will get passed existing panel data
  select: ResolutionSelection;
  resolutions: QueriesForResolution[];
}
