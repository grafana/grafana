import { DataQuery } from '@grafana/ui';

export enum ResolutionSelection {
  range = 'range',
  interval = 'interval',
}

export interface QueriesForResolution {
  resolution?: string;
  ms: number; // Will be -Infinity when resolution is not set
  targets: DataQuery[];
  datasource?: string; // Datasource to apply by default
}

export interface MultiResolutionQuery extends DataQuery {
  live?: DataQuery; // Will get passed existing panel data
  select: ResolutionSelection;
  resolutions: QueriesForResolution[];
}
