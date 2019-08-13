import { LogsDedupStrategy } from '@grafana/data';

export interface LogsOptions {
  showTime: boolean;
  showLabels: boolean;
  dedupStrategy: LogsDedupStrategy;
}

export interface Options {
  logs: LogsOptions;
}

export const defaults: Options = {
  logs: {
    showTime: true,
    showLabels: false,
    dedupStrategy: LogsDedupStrategy.none,
  },
};
