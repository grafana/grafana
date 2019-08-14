import { LogsDedupStrategy } from '@grafana/data';

export interface Options {
  showTime: boolean;
  showLabels: boolean;
  dedupStrategy: LogsDedupStrategy;
}

export const defaults: Options = {
  showTime: true,
  showLabels: false,
  dedupStrategy: LogsDedupStrategy.none,
};
