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

import { SearchProps, Tag } from '../../useSearch';
import { TNil, TraceKeyValuePair, TraceSpan } from '../types';

// filter spans where all filters added need to be true for each individual span that is returned
// i.e. the more filters added -> the more specific that the returned results are
export function filterSpansNewTraceView(searchProps: SearchProps, spans: TraceSpan[] | TNil) {
  if (!spans) {
    return undefined;
  }

  const arraysToMatchAcross = [];
  if (searchProps.serviceName) {
    arraysToMatchAcross.push(getServiceNameMatches(spans, searchProps));
  }
  if (searchProps.spanName) {
    arraysToMatchAcross.push(getSpanNameMatches(spans, searchProps));
  }
  if (searchProps.from || searchProps.to) {
    arraysToMatchAcross.push(getDurationMatches(spans, searchProps));
  }
  const tagMatches = getTagMatches(spans, searchProps.tags);
  if (tagMatches) {
    arraysToMatchAcross.push(tagMatches);
  }

  if (arraysToMatchAcross.length > 0) {
    return new Set([...arraysToMatchAcross].reduce((a, b) => a.filter((c) => b.includes(c))));
  }
  return undefined;
}

const getTagMatches = (spans: TraceSpan[], tags: Tag[]) => {
  // remove empty tags
  tags = tags.filter((tag) => {
    return (tag.key && tag.key !== '') || tag.value;
  });

  if (tags.length > 0) {
    return spans
      .filter((span: TraceSpan) => {
        // match against every tag filter (AND filter)
        return tags.every((tag: Tag) => {
          // tag.key === '' when it is cleared via pressing x icon in select field
          if (tag.key && tag.value) {
            const found = span.tags.some((kv) => checkKeyAndValueForMatch(tag, kv));
            const found2 = span.process.tags.some((kv) => checkKeyAndValueForMatch(tag, kv));
            const found3 = span.logs.some((log) => log.fields.some((kv) => checkKeyAndValueForMatch(tag, kv)));
            return checkForMatch(tag.operator, found, found2, found3);
          } else if (tag.key) {
            const found = span.tags.some((kv) => checkKeyForMatch(tag.key!, kv.key));
            const found2 = span.process.tags.some((kv) => checkKeyForMatch(tag.key!, kv.key));
            const found3 = span.logs.some((log) => log.fields.some((kv) => checkKeyForMatch(tag.key!, kv.key)));
            return checkForMatch(tag.operator, found, found2, found3);
          }
          return false;
        });
      })
      .map((span: TraceSpan) => span.spanID);
  }
  return undefined;
};

const checkForMatch = (operator: string, found: boolean, found2: boolean, found3: boolean) => {
  return operator === '=' ? found || found2 || found3 : !found && !found2 && !found3;
};

const checkKeyForMatch = (tagKey: string, key: string) => {
  return tagKey === key.toString() ? true : false;
};

const checkKeyAndValueForMatch = (tag: Tag, kv: TraceKeyValuePair) => {
  return tag.key === kv.key.toString() && tag.value === kv.value.toString() ? true : false;
};

const getServiceNameMatches = (spans: TraceSpan[], searchProps: SearchProps) => {
  return spans
    .filter((span: TraceSpan) => {
      return searchProps.serviceNameOperator === '='
        ? span.process.serviceName === searchProps.serviceName
        : span.process.serviceName !== searchProps.serviceName;
    })
    .map((span: TraceSpan) => span.spanID);
};

const getSpanNameMatches = (spans: TraceSpan[], searchProps: SearchProps) => {
  return spans
    .filter((span: TraceSpan) => {
      return searchProps.spanNameOperator === '='
        ? span.operationName === searchProps.spanName
        : span.operationName !== searchProps.spanName;
    })
    .map((span: TraceSpan) => span.spanID);
};

const getDurationMatches = (spans: TraceSpan[], searchProps: SearchProps) => {
  const from = convertTimeFilter(searchProps?.from || '');
  const to = convertTimeFilter(searchProps?.to || '');
  let filteredSpans: TraceSpan[] = [];

  if (from) {
    filteredSpans = spans.filter((span: TraceSpan) => {
      return searchProps.fromOperator === '>' ? span.duration > from : span.duration >= from;
    });
  }
  if (to) {
    if (filteredSpans.length > 0) {
      filteredSpans = filteredSpans.filter((span: TraceSpan) => {
        return searchProps.toOperator === '<' ? span.duration < to : span.duration <= to;
      });
    } else {
      filteredSpans = spans.filter((span: TraceSpan) => {
        return searchProps.toOperator === '<' ? span.duration < to : span.duration <= to;
      });
    }
  }

  return filteredSpans.map((span: TraceSpan) => span.spanID);
};

const convertTimeFilter = (time: string) => {
  if (time.includes('μs')) {
    return parseFloat(time.split('μs')[0]);
  } else if (time.includes('ms')) {
    return parseFloat(time.split('ms')[0]) * 1000;
  } else if (time.includes('s')) {
    return parseFloat(time.split('s')[0]) * 1000 * 1000;
  } else if (time.includes('m')) {
    return parseFloat(time.split('m')[0]) * 1000 * 1000 * 60;
  } else if (time.includes('h')) {
    return parseFloat(time.split('h')[0]) * 1000 * 1000 * 60 * 60;
  }
  return undefined;
};

// legacy code that will be removed when the newTraceView feature flag is removed
export function filterSpans(textFilter: string, spans: TraceSpan[] | TNil) {
  if (!spans) {
    return undefined;
  }

  // if a span field includes at least one filter in includeFilters, the span is a match
  const includeFilters: string[] = [];

  // values with keys that include text in any one of the excludeKeys will be ignored
  const excludeKeys: string[] = [];

  // split textFilter by whitespace, remove empty strings, and extract includeFilters and excludeKeys
  textFilter
    .split(/\s+/)
    .filter(Boolean)
    .forEach((w) => {
      if (w[0] === '-') {
        excludeKeys.push(w.slice(1).toLowerCase());
      } else {
        includeFilters.push(w.toLowerCase());
      }
    });

  const isTextInFilters = (filters: string[], text: string) =>
    filters.some((filter) => text.toLowerCase().includes(filter));

  const isTextInKeyValues = (kvs: TraceKeyValuePair[]) =>
    kvs
      ? kvs.some((kv) => {
          // ignore checking key and value for a match if key is in excludeKeys
          if (isTextInFilters(excludeKeys, kv.key)) {
            return false;
          }
          // match if key or value matches an item in includeFilters
          return isTextInFilters(includeFilters, kv.key) || isTextInFilters(includeFilters, kv.value.toString());
        })
      : false;

  const isSpanAMatch = (span: TraceSpan) =>
    isTextInFilters(includeFilters, span.operationName) ||
    isTextInFilters(includeFilters, span.process.serviceName) ||
    isTextInKeyValues(span.tags) ||
    (span.logs !== null && span.logs.some((log) => isTextInKeyValues(log.fields))) ||
    isTextInKeyValues(span.process.tags) ||
    includeFilters.some((filter) => filter === span.spanID);

  // declare as const because need to disambiguate the type
  const rv: Set<string> = new Set(spans.filter(isSpanAMatch).map((span: TraceSpan) => span.spanID));
  return rv;
}
