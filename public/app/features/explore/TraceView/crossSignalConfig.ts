import { type TraceToLogsTag } from '@grafana/o11y-ds-frontend';

import { type TraceSpan } from './components/types/trace';

/** Loki/Prometheus label names cannot contain dots; OTel attributes commonly use them. */
export function toLokiLabelName(name: string): string {
  return name.replace(/\./g, '_');
}

const normalize = (tag: string) => {
  return {
    key: tag,
    value: tag.includes('.') ? toLokiLabelName(tag) : undefined,
  };
};

const DEFAULT_CROSS_SIGNAL_TAGS = ['cluster', 'hostname', 'namespace', 'pod', 'service.name', 'service.namespace'];
export function getDefaultLogsTags(): TraceToLogsTag[] {
  return DEFAULT_CROSS_SIGNAL_TAGS.map(normalize);
}

export function getDefaultMetricTags(): TraceToLogsTag[] {
  return DEFAULT_CROSS_SIGNAL_TAGS.map(normalize);
}

const DEFAULT_PROFILING_TAGS = ['service.name', 'service.namespace'];
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

type TagFormatOptions = {
  labelValueSign?: string;
  joinBy?: string;
  /** Transform the label name written into the query (e.g. dots → underscores for Loki). */
  normalizeLabelName?: (name: string) => string;
};

/**
 * Creates a string representing all the tags already formatted for use in the query. The tags are filtered so that
 * only intersection of tags that exist in a span and tags that you want are serialized into the string.
 */
export function getFormattedTags(
  allTags: TraceToLogsTag[],
  tagsToUse: TraceToLogsTag[],
  { joinBy = ', ', ...filterOptions }: TagFormatOptions = {}
) {
  // In order, try to use mapped tags -> tags -> default tags
  // Build tag portion of query
  return getFilteredTags(allTags, tagsToUse, filterOptions).join(joinBy);
}

export function getFilteredTags(
  allTags: TraceToLogsTag[],
  tagsToUse: TraceToLogsTag[],
  { labelValueSign = '=', normalizeLabelName }: Omit<TagFormatOptions, 'joinBy'> = {}
) {
  return allTags
    .map((tag) => {
      const keyValue = tagsToUse.find((keyValue) => keyValue.key === tag.key);
      if (keyValue) {
        let labelName = keyValue.value ? keyValue.value : keyValue.key;
        if (normalizeLabelName) {
          labelName = normalizeLabelName(labelName);
        }
        return `${labelName}${labelValueSign}"${tag.value}"`;
      }
      return undefined;
    })
    .filter((v): v is string => Boolean(v));
}
