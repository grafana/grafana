export type TimingOptions = {
  group_wait?: string;
  group_interval?: string;
  repeat_interval?: string;
};

export const TIMING_OPTIONS_DEFAULTS: Required<TimingOptions> = {
  group_wait: '30s',
  group_interval: '5m',
  repeat_interval: '4h',
};
