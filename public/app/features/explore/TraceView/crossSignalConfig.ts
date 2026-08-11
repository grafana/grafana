import { type TraceToLogsTag } from '@grafana/o11y-ds-frontend';

import { type TraceSpan } from './components/types/trace';

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

export function getSpanTags(span: TraceSpan) {
  return [
    ...span.process.tags,
    ...span.tags,
    { key: 'spanId', value: span.spanID },
    { key: 'traceId', value: span.traceID },
    { key: 'name', value: span.operationName },
    { key: 'duration', value: span.duration },
  ];
}

/**
 * Creates a string representing all the tags already formatted for use in the query. The tags are filtered so that
 * only intersection of tags that exist in a span and tags that you want are serialized into the string.
 */
export function getFormattedTags(
  allTags: TraceToLogsTag[],
  tagsToUse: TraceToLogsTag[],
  { labelValueSign = '=', joinBy = ', ' }: { labelValueSign?: string; joinBy?: string } = {}
) {
  // In order, try to use mapped tags -> tags -> default tags
  // Build tag portion of query
  return allTags
    .map((tag) => {
      const keyValue = tagsToUse.find((keyValue) => keyValue.key === tag.key);
      if (keyValue) {
        return `${keyValue.value ? keyValue.value : keyValue.key}${labelValueSign}"${tag.value}"`;
      }
      return undefined;
    })
    .filter((v) => Boolean(v))
    .join(joinBy);
}
