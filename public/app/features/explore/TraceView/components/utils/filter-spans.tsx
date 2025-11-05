// Copyright (c) 2019 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { SpanStatusCode } from '@opentelemetry/api';

import { SelectableValue, TraceKeyValuePair, TraceSearchProps, TraceSearchTag } from '@grafana/data';

import { KIND, LIBRARY_NAME, LIBRARY_VERSION, STATUS, STATUS_MESSAGE, TRACE_STATE, ID } from '../constants/span';
import TNil from '../types/TNil';
import { TraceSpan, CriticalPathSection } from '../types/trace';

/**
 * Filter spans using adhoc filters.
 * Returns filtered spans or undefined if no filters match.
 */
const getAdhocFilterMatches = (spans: TraceSpan[], adhocFilters: Array<SelectableValue<string>>) => {
  // Remove empty filters
  const validFilters = adhocFilters.filter((filter) => {
    return filter.key && filter.key.trim() !== '' && filter.value && filter.value.trim() !== '';
  });

  if (validFilters.length === 0) {
    return undefined;
  }

  return spans.filter((span: TraceSpan) => {
    // All filters must match for the span to be included
    return validFilters.every((filter) => {
      const key = filter.key || '';
      const operator = filter.operator || '=';
      const value = filter.value || '';

      // Special handling for _textSearch_
      if (key === '_textSearch_') {
        return matchTextSearch(value, span);
      }

      // Special handling for serviceName
      if (key === 'serviceName') {
        return matchField(span.process.serviceName, operator, value);
      }

      // Special handling for spanName (operationName)
      if (key === 'spanName') {
        return matchField(span.operationName, operator, value);
      }

      if (key === 'duration') {
        return matchTimeField(span.duration, operator, value);
      }

      // Handle tag filters (same logic as getTagMatches)
      const tagFilter: TraceSearchTag = {
        id: '', // Not needed for matching
        key,
        operator,
        value,
      };

      if (operator === '=' || operator === '!=') {
        const matches = checkKeyValConditionForMatch(tagFilter, span);
        return operator === '=' ? matches : !matches;
      } else if (operator === '=~' || operator === '!~') {
        const matches = checkKeyValConditionForRegex(tagFilter, span);
        return operator === '=~' ? matches : !matches;
      }

      return false;
    });
  });
};

/**
 * Match a field value against an operator and expected value.
 */
const matchField = (fieldValue: string, operator: string, expectedValue: string): boolean => {
  if (operator === '=') {
    return fieldValue === expectedValue;
  } else if (operator === '!=') {
    return fieldValue !== expectedValue;
  } else if (operator === '=~') {
    return fieldValue.includes(expectedValue);
  } else if (operator === '!~') {
    return !fieldValue.includes(expectedValue);
  }
  return false;
};

/**
 * Match a field value against an operator and expected value.
 */
const matchTimeField = (fieldValue: number, operator: string, expectedValue: string): boolean => {
  const timeFilter = convertTimeFilter(expectedValue);

  if (!timeFilter) {
    return false;
  }
  if (operator === '>=') {
    return fieldValue >= timeFilter;
  } else if (operator === '<=') {
    return fieldValue <= timeFilter;
  }
  return false;
};

/**
 * Match text search across all span fields.
 */
const matchTextSearch = (query: string, span: TraceSpan): boolean => {
  const queryParts = query
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());

  const isTextInQuery = (text: string) => queryParts.some((queryPart) => text.toLowerCase().includes(queryPart));

  const isTextInKeyValues = (kvs: TraceKeyValuePair[]) =>
    kvs
      ? kvs.some((kv) => {
          return isTextInQuery(kv.key) || isTextInQuery(getStringValue(kv.value));
        })
      : false;

  return (
    isTextInQuery(span.operationName) ||
    isTextInQuery(span.process.serviceName) ||
    isTextInKeyValues(span.tags) ||
    (span.kind && isTextInQuery(span.kind)) ||
    (span.statusCode !== undefined && isTextInQuery(SpanStatusCode[span.statusCode])) ||
    (span.statusMessage && isTextInQuery(span.statusMessage)) ||
    (span.instrumentationLibraryName && isTextInQuery(span.instrumentationLibraryName)) ||
    (span.instrumentationLibraryVersion && isTextInQuery(span.instrumentationLibraryVersion)) ||
    (span.traceState && isTextInQuery(span.traceState)) ||
    (span.logs !== null &&
      span.logs.some((log) => (log.name && isTextInQuery(log.name)) || isTextInKeyValues(log.fields))) ||
    isTextInKeyValues(span.process.tags) ||
    queryParts.some((queryPart) => queryPart === span.spanID)
  );
};

// filter spans where all filters added need to be true for each individual span that is returned
// i.e. the more filters added -> the more specific that the returned results are
export function filterSpans(
  searchProps: TraceSearchProps,
  spans: TraceSpan[] | TNil,
  criticalPath?: CriticalPathSection[]
) {
  if (!spans) {
    return undefined;
  }

  let filteredSpans = false;

  // New adhoc filters approach
  if (searchProps.adhocFilters && searchProps.adhocFilters.length > 0) {
    const adhocMatches = getAdhocFilterMatches(spans, searchProps.adhocFilters);
    if (adhocMatches) {
      spans = adhocMatches;
      filteredSpans = true;
    }
  }

  // Legacy filters (kept for backward compatibility)
  if (searchProps.serviceName) {
    spans = getServiceNameMatches(spans, searchProps);
    filteredSpans = true;
  }
  if (searchProps.spanName) {
    spans = getSpanNameMatches(spans, searchProps);
    filteredSpans = true;
  }
  if (searchProps.from || searchProps.to) {
    spans = getDurationMatches(spans, searchProps);
    filteredSpans = true;
  }
  const tagMatches = getTagMatches(spans, searchProps.tags);
  if (tagMatches) {
    spans = tagMatches;
    filteredSpans = true;
  }

  if (searchProps.query) {
    const queryMatches = getQueryMatches(searchProps.query, spans);
    if (queryMatches) {
      spans = queryMatches;
      filteredSpans = true;
    }
  }

  // Critical path filtering
  if (searchProps.criticalPathOnly && criticalPath) {
    spans = getCriticalPathMatches(spans, criticalPath);
    filteredSpans = true;
  }

  return filteredSpans ? new Set(spans.map((span: TraceSpan) => span.spanID)) : undefined;
}

export function getQueryMatches(query: string, spans: TraceSpan[] | TNil) {
  if (!spans) {
    return undefined;
  }

  const queryParts: string[] = [];

  // split query by whitespace, remove empty strings, and extract filters
  query
    .split(/\s+/)
    .filter(Boolean)
    .forEach((w) => {
      queryParts.push(w.toLowerCase());
    });

  const isTextInQuery = (queryParts: string[], text: string) =>
    queryParts.some((queryPart) => text.toLowerCase().includes(queryPart));

  const isTextInKeyValues = (kvs: TraceKeyValuePair[]) =>
    kvs
      ? kvs.some((kv) => {
          return isTextInQuery(queryParts, kv.key) || isTextInQuery(queryParts, getStringValue(kv.value));
        })
      : false;

  const isSpanAMatch = (span: TraceSpan) =>
    isTextInQuery(queryParts, span.operationName) ||
    isTextInQuery(queryParts, span.process.serviceName) ||
    isTextInKeyValues(span.tags) ||
    (span.kind && isTextInQuery(queryParts, span.kind)) ||
    (span.statusCode !== undefined && isTextInQuery(queryParts, SpanStatusCode[span.statusCode])) ||
    (span.statusMessage && isTextInQuery(queryParts, span.statusMessage)) ||
    (span.instrumentationLibraryName && isTextInQuery(queryParts, span.instrumentationLibraryName)) ||
    (span.instrumentationLibraryVersion && isTextInQuery(queryParts, span.instrumentationLibraryVersion)) ||
    (span.traceState && isTextInQuery(queryParts, span.traceState)) ||
    (span.logs !== null &&
      span.logs.some((log) => (log.name && isTextInQuery(queryParts, log.name)) || isTextInKeyValues(log.fields))) ||
    isTextInKeyValues(span.process.tags) ||
    queryParts.some((queryPart) => queryPart === span.spanID);

  return spans.filter(isSpanAMatch);
}

const getTagMatches = (spans: TraceSpan[], tags: TraceSearchTag[]) => {
  // remove empty/default tags
  tags = tags.filter((tag) => {
    // tag.key === '' when it is cleared via pressing x icon in select field
    return (tag.key && tag.key !== '') || tag.value;
  });

  if (tags.length > 0) {
    return spans.filter((span: TraceSpan) => {
      // match against every tag filter
      return tags.every((tag: TraceSearchTag) => {
        if (tag.key && tag.value) {
          if (
            (tag.operator === '=' && checkKeyValConditionForMatch(tag, span)) ||
            (tag.operator === '=~' && checkKeyValConditionForRegex(tag, span)) ||
            (tag.operator === '!=' && !checkKeyValConditionForMatch(tag, span)) ||
            (tag.operator === '!~' && !checkKeyValConditionForRegex(tag, span))
          ) {
            return true;
          }
          return false;
        } else if (tag.key) {
          if (
            span.tags.some((kv) => checkKeyForMatch(tag.key!, kv.key)) ||
            span.process.tags.some((kv) => checkKeyForMatch(tag.key!, kv.key)) ||
            (span.logs && span.logs.some((log) => log.fields.some((kv) => checkKeyForMatch(tag.key!, kv.key)))) ||
            (span.kind && tag.key === KIND) ||
            (span.statusCode !== undefined && tag.key === STATUS) ||
            (span.statusMessage && tag.key === STATUS_MESSAGE) ||
            (span.instrumentationLibraryName && tag.key === LIBRARY_NAME) ||
            (span.instrumentationLibraryVersion && tag.key === LIBRARY_VERSION) ||
            (span.traceState && tag.key === TRACE_STATE) ||
            tag.key === ID
          ) {
            return tag.operator === '=' || tag.operator === '=~' ? true : false;
          }
          return tag.operator === '=' || tag.operator === '=~' ? false : true;
        }
        return false;
      });
    });
  }
  return undefined;
};

const checkKeyValConditionForRegex = (tag: TraceSearchTag, span: TraceSpan) => {
  return (
    span.tags.some((kv) => checkKeyAndValueForRegex(tag, kv)) ||
    span.process.tags.some((kv) => checkKeyAndValueForRegex(tag, kv)) ||
    (span.logs && span.logs.some((log) => log.fields.some((kv) => checkKeyAndValueForRegex(tag, kv)))) ||
    (span.kind && tag.key === KIND && tag.value?.includes(span.kind)) ||
    (span.statusCode !== undefined &&
      tag.key === STATUS &&
      tag.value?.includes(SpanStatusCode[span.statusCode].toLowerCase())) ||
    (span.statusMessage && tag.key === STATUS_MESSAGE && tag.value?.includes(span.statusMessage)) ||
    (span.instrumentationLibraryName &&
      tag.key === LIBRARY_NAME &&
      tag.value?.includes(span.instrumentationLibraryName)) ||
    (span.instrumentationLibraryVersion &&
      tag.key === LIBRARY_VERSION &&
      tag.value?.includes(span.instrumentationLibraryVersion)) ||
    (span.traceState && tag.key === TRACE_STATE && tag.value?.includes(span.traceState)) ||
    (tag.key === ID && tag.value?.includes(span.spanID))
  );
};

const checkKeyValConditionForMatch = (tag: TraceSearchTag, span: TraceSpan) => {
  return (
    span.tags.some((kv) => checkKeyAndValueForMatch(tag, kv)) ||
    span.process.tags.some((kv) => checkKeyAndValueForMatch(tag, kv)) ||
    (span.logs && span.logs.some((log) => log.fields.some((kv) => checkKeyAndValueForMatch(tag, kv)))) ||
    (span.kind && tag.key === KIND && tag.value === span.kind) ||
    (span.statusCode !== undefined &&
      tag.key === STATUS &&
      tag.value === SpanStatusCode[span.statusCode].toLowerCase()) ||
    (span.statusMessage && tag.key === STATUS_MESSAGE && tag.value === span.statusMessage) ||
    (span.instrumentationLibraryName && tag.key === LIBRARY_NAME && tag.value === span.instrumentationLibraryName) ||
    (span.instrumentationLibraryVersion &&
      tag.key === LIBRARY_VERSION &&
      tag.value === span.instrumentationLibraryVersion) ||
    (span.traceState && tag.key === TRACE_STATE && tag.value === span.traceState) ||
    (tag.key === ID && tag.value === span.spanID)
  );
};

const checkKeyForMatch = (tagKey: string, key: string) => {
  return tagKey === key.toString();
};

const checkKeyAndValueForMatch = (tag: TraceSearchTag, kv: TraceKeyValuePair) => {
  return tag.key === kv.key && tag.value === getStringValue(kv.value);
};

const checkKeyAndValueForRegex = (tag: TraceSearchTag, kv: TraceKeyValuePair) => {
  return kv.key.includes(tag.key || '') && getStringValue(kv.value).includes(tag.value || '');
};

const getStringValue = (value: string | number | boolean | undefined) => {
  return value ? value.toString() : '';
};

const getServiceNameMatches = (spans: TraceSpan[], searchProps: TraceSearchProps) => {
  return spans.filter((span: TraceSpan) => {
    return searchProps.serviceNameOperator === '='
      ? span.process.serviceName === searchProps.serviceName
      : span.process.serviceName !== searchProps.serviceName;
  });
};

const getSpanNameMatches = (spans: TraceSpan[], searchProps: TraceSearchProps) => {
  return spans.filter((span: TraceSpan) => {
    return searchProps.spanNameOperator === '='
      ? span.operationName === searchProps.spanName
      : span.operationName !== searchProps.spanName;
  });
};

const getDurationMatches = (spans: TraceSpan[], searchProps: TraceSearchProps) => {
  const from = convertTimeFilter(searchProps?.from || '');
  const to = convertTimeFilter(searchProps?.to || '');
  let filteredSpans: TraceSpan[] = [];

  if (from) {
    filteredSpans = spans.filter((span: TraceSpan) => {
      return searchProps.fromOperator === '>' ? span.duration > from : span.duration >= from;
    });
  }
  if (to) {
    const filterForDuration = (span: TraceSpan) =>
      searchProps.toOperator === '<' ? span.duration < to : span.duration <= to;
    filteredSpans =
      filteredSpans.length > 0
        ? filteredSpans.filter((span: TraceSpan) => {
            return filterForDuration(span);
          })
        : spans.filter((span: TraceSpan) => {
            return filterForDuration(span);
          });
  }

  return filteredSpans;
};

const getCriticalPathMatches = (spans: TraceSpan[], criticalPath: CriticalPathSection[]) => {
  return spans.filter((span: TraceSpan) => {
    return criticalPath.some((section) => section.spanId === span.spanID);
  });
};

export const convertTimeFilter = (time: string) => {
  if (time.includes('ns')) {
    return parseFloat(time.split('ns')[0]) / 1000;
  } else if (time.includes('us')) {
    return parseFloat(time.split('us')[0]);
  } else if (time.includes('µs')) {
    return parseFloat(time.split('µs')[0]);
  } else if (time.includes('ms')) {
    return parseFloat(time.split('ms')[0]) * 1000;
  } else if (time.includes('s')) {
    return parseFloat(time.split('s')[0]) * 1000 * 1000;
  } else if (time.includes('m')) {
    return parseFloat(time.split('m')[0]) * 1000 * 1000 * 60;
  } else if (time.includes('h')) {
    return parseFloat(time.split('h')[0]) * 1000 * 1000 * 60 * 60;
  }
  return parseFloat(time);
};
