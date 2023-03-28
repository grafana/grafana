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
  if (searchProps.tags[0].key || searchProps.tags[0].value) {
    arraysToMatchAcross.push(getTagMatches(spans, searchProps.tags));
  }
  if (searchProps.from || searchProps.to) {
    arraysToMatchAcross.push(getDurationMatches(spans, searchProps));
  }

  if (arraysToMatchAcross.length > 0) {
    return new Set([...arraysToMatchAcross].reduce((a, b) => a.filter((c) => b.includes(c))));
  }
  return new Set([]);
}

const getTagMatches = (spans: TraceSpan[], tags: Tag[]) => {
  return spans
    .filter((span: TraceSpan) => {
      const spanTags = getTagsFromSpan(span);

      // match against every tag filter
      return tags.every((tag: Tag) => {
        if (tag.key && tag.value) {
          if (spanTags[tag.key]) {
            return tag.operator === '='
              ? spanTags[tag.key].includes(tag.value)
              : !spanTags[tag.key].includes(tag.value);
          }
          return false;
        } else if (tag.key) {
          const match = checkTagsForMatch(tag.key, Object.keys(spanTags), tag.operator);
          console.log('key matches', match);
          return match;
        } else if (tag.value) {
          const match = checkTagsForMatch(tag.value, Object.values(spanTags).flat(), tag.operator);
          console.log('value matches', match);
          return match;
        }
        return false;
      });
    })
    .map((span: TraceSpan) => span.spanID);
};

export const getTagsFromSpan = (span: TraceSpan) => {
  // there can be fields in logs that have the same key across logs but different values
  const spanTags: { [tag: string]: string[] } = {};
  span.tags.map((tag) =>
    spanTags[tag.key.toString()]
      ? spanTags[tag.key.toString()].push(tag.value.toString())
      : (spanTags[tag.key.toString()] = [tag.value.toString()])
  );
  span.process.tags.map((tag) =>
    spanTags[tag.key.toString()]
      ? spanTags[tag.key.toString()].push(tag.value.toString())
      : (spanTags[tag.key.toString()] = [tag.value.toString()])
  );
  if (span.logs !== null) {
    span.logs.map((log) => {
      log.fields.map((field) => {
        if (spanTags[field.key.toString()]) {
          spanTags[field.key.toString()].push(field.value.toString());
        } else {
          spanTags[field.key.toString()] = [field.value.toString()];
        }
      });
    });
  }
  return spanTags;
};

// const addTagFromSpan = (spanTags: { [tag: string]: string[] }, tag: Tag) => {
//   spanTags[tag.key!.toString()] ? spanTags[tag.key!.toString()].push(tag.value!.toString()) : spanTags[tag.key!.toString()] = [tag.value!.toString()];
// }

const checkTagsForMatch = (needle: string, haystack: string[], operator: string) => {
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
