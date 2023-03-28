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

import { v4 as uuidv4 } from 'uuid';

import { SearchProps, Tag } from '../../useSearch';
import { TNil, TraceSpan } from '../types';

export default function filterSpans(searchProps: SearchProps, spans: TraceSpan[] | TNil) {
  if (!spans) {
    return new Set([]);
  }

  const arraysToMatchAcross = [];
  if (searchProps.serviceName) {
    arraysToMatchAcross.push(getServiceNameMatches(spans, searchProps));
  }
  if (searchProps.spanName) {
    arraysToMatchAcross.push(getSpanNameMatches(spans, searchProps));
  }
  if (searchProps.tags) {
    arraysToMatchAcross.push(getTagMatches(spans, searchProps.tags));
  }
  if (searchProps.from || searchProps.to) {
    arraysToMatchAcross.push(getDurationMatches(spans, searchProps));
  }

  if (arraysToMatchAcross.length > 0) {
    return new Set([...arraysToMatchAcross].reduce((a, b) => a.filter((c) => b.includes(c))));
  }
  return new Set(arraysToMatchAcross);
}

const getTagMatches = (spans: TraceSpan[], tags: Tag[]) => {
  return spans
    .filter((span: TraceSpan) => {
      const spanTags = getTagsFromSpan(span);

      return tags.some((tag: Tag) => {
        if (tag.key && tag.value) {
          if (spanTags[tag.key]) {
            if (tag.operator === '=') {
              return spanTags[tag.key] === tag.value;
            } else {
              return spanTags[tag.key] !== tag.value;
            }
          }
          return false;
        } else if (tag.key) {
          const match = checkForMatch(tag.key, Object.keys(spanTags), tag.operator);
          console.log('key matches', match);
          return match;
        } else if (tag.value) {
          const match = checkForMatch(tag.value, Object.values(spanTags), tag.operator);
          console.log('value matches', match);
          return match;
        }
        return false;
      });
    })
    .map((span: TraceSpan) => span.spanID);

  // // if a span field includes at least one filter in includeFilters, the span is a match
  // const includeFilters: string[] = [];

  // // values with keys that include text in any one of the excludeKeys will be ignored
  // const excludeKeys: string[] = [];

  // // split textFilter by whitespace, remove empty strings, and extract includeFilters and excludeKeys
  // tags
  //   .split(/\s+/)
  //   .filter(Boolean)
  //   .forEach((w) => {
  //     if (w[0] === '-') {
  //       excludeKeys.push(w.slice(1).toLowerCase());
  //     } else {
  //       includeFilters.push(w.toLowerCase());
  //     }
  //   });

  // const isTextInFilters = (filters: string[], text: string) =>
  //   filters.some((filter) => text.toLowerCase().includes(filter));
  // const isTextInKeyValues = (kvs: TraceKeyValuePair[]) => {
  //   return kvs.some((kv) => {
  //     // ignore checking key and value for a match if key is in excludeKeys
  //     if (isTextInFilters(excludeKeys, kv.key)) {
  //       return false;
  //     }

  //     const match = includeFilters.some((filter) => {
  //       if (filter.includes('=')) {
  //         // match if key and value matches an item in includeFilters
  //         const a = `${kv.key}=${kv.value}`.toLowerCase().includes(filter);
  //         if (a) {
  //           // console.log('f=', filter, kv);
  //         }
  //         return a;
  //       } else {
  //         // match if key or value matches an item in includeFilters
  //         const b = kv.key.toLowerCase().includes(filter) || kv.value.toString().toLowerCase().includes(filter);
  //         if (b) {
  //           // console.log('f', filter, kv);
  //         }
  //         return b;
  //       }
  //     });

  //     return match;
  //   });
  // };

  // const areTagsAMatch = (span: TraceSpan) =>
  //   isTextInKeyValues(span.tags) ||
  //   (span.logs !== null && span.logs.some((log) => isTextInKeyValues(log.fields))) ||
  //   isTextInKeyValues(span.process.tags) ||
  //   includeFilters.some((filter) => filter === span.spanID);

  // return spans.filter(areTagsAMatch).map((span: TraceSpan) => span.spanID);
};

export const getTagsFromSpan = (span: TraceSpan) => {
  const spanTags: { [x: string]: string } = {};
  span.tags.map((x) => (spanTags[x.key.toString()] = x.value.toString()));
  span.process.tags.map((x) => (spanTags[x.key.toString()] = x.value.toString()));
  // TODO: JOEY: logs tags
  return spanTags;
};

const checkForMatch = (needle: string, haystack: string[], operator: string) => {
  return operator === '=' ? haystack.includes(needle) : !haystack.includes(needle);
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
    filteredSpans = filteredSpans.filter((span: TraceSpan) => {
      return searchProps.toOperator === '<' ? span.duration < to : span.duration <= to;
    });
  }

  return filteredSpans.map((span: TraceSpan) => span.spanID);
};

const convertTimeFilter = (time: string) => {
  if (time.includes('μs')) {
    return parseInt(time.split('μs')[0], 10);
  } else if (time.includes('ms')) {
    return parseInt(time.split('ms')[0], 10) * 1000; // TODO: JOEY: 27.3ms doesn't work
  } else if (time.includes('s')) {
    return parseInt(time.split('s')[0], 10) * 1000 * 1000;
  } else if (time.includes('m')) {
    return parseInt(time.split('m')[0], 10) * 1000 * 1000 * 60;
  } else if (time.includes('h')) {
    return parseInt(time.split('h')[0], 10) * 1000 * 1000 * 60 * 60;
  }
  return undefined;
};

export const randomId = () => uuidv4().slice(0, 12);
