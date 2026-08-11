import { type TraceToLogsTag } from '@grafana/o11y-ds-frontend';

const normalize = (tag: string) => {
  return {
    key: tag,
    value: tag.includes('.') ? tag.replace('.', '_') : undefined,
  };
};

export const DEFAULT_CROSS_SIGNAL_TAGS = [
  'cluster',
  'hostname',
  'namespace',
  'pod',
  'service.name',
  'service.namespace',
];
export function getDefaultLogsTags(): TraceToLogsTag[] {
  return DEFAULT_CROSS_SIGNAL_TAGS.map(normalize);
}

export function getDefaultMetricTags(): TraceToLogsTag[] {
  return DEFAULT_CROSS_SIGNAL_TAGS.map(normalize);
}

export const DEFAULT_PROFILING_TAGS = ['service.name', 'service.namespace'];
export function getDefaultProfilingTags() {
  return DEFAULT_PROFILING_TAGS.map(normalize);
}
