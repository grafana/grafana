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
import { TNil, TraceKeyValuePair, TraceSpan } from '../types';

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
  // remove empty tags
  tags = tags.filter((tag) => {
    return tag.key || tag.value;
  });

  return spans
    .filter((span: TraceSpan) => {
      // match against every tag filter
      return tags.every((tag: Tag) => {
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
