//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
import { LogsSortOrder, LogsDedupStrategy } from '@grafana/data';

export const modelVersion = Object.freeze([1, 0]);

export interface PanelOptions {
  showLabels: boolean;
  showTime: boolean;
  wrapLogMessage: boolean;
  enableLogDetails: boolean;
  sortOrder: LogsSortOrder;
  dedupStrategy: LogsDedupStrategy;
}

export const defaultPanelOptions: PanelOptions = {
  showLabels: false,
  showTime: false,
  wrapLogMessage: false,
  enableLogDetails: true,
  sortOrder: LogsSortOrder.Descending,
  dedupStrategy: LogsDedupStrategy.none,
};
