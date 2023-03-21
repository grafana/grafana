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

import { SearchProps } from '../../useSearch';
import { TNil, TraceKeyValuePair, TraceSpan } from '../types';

export default function filterSpans(searchProps: SearchProps, spans: TraceSpan[] | TNil) {
  if (!spans) {
    return undefined;
  }

  const arraysToMatchAcross = [];
  if (searchProps.serviceName) {
    arraysToMatchAcross.push(getServiceNameMatches(spans, searchProps.serviceName));
  } 
  if (searchProps.spanName) {
    arraysToMatchAcross.push(getSpanNameMatches(spans, searchProps.spanName));
  } 
  if (searchProps.tags) {
    arraysToMatchAcross.push(getTagMatches(spans, searchProps.tags));
  } 
  // else if (searchProps.text) {
  //   // if a span field includes at least one filter in includeFilters, the span is a match
  //   const includeFilters: string[] = [];

  //   // values with keys that include text in any one of the excludeKeys will be ignored
  //   const excludeKeys: string[] = [];

  //   // split textFilter by whitespace, remove empty strings, and extract includeFilters and excludeKeys
  //   searchProps.text
  //     .split(/\s+/)
  //     .filter(Boolean)
  //     .forEach((w) => {
  //       if (w[0] === '-') {
  //         excludeKeys.push(w.slice(1).toLowerCase());
  //       } else {
  //         includeFilters.push(w.toLowerCase());
  //       }
  //     });

  //   const isTextInFilters = (filters: string[], text: string) =>
  //     filters.some((filter) => text.toLowerCase().includes(filter));

  //   const isTextInKeyValues = (kvs: TraceKeyValuePair[]) =>
  //     kvs
  //       ? kvs.some((kv) => {
  //           // ignore checking key and value for a match if key is in excludeKeys
  //           if (isTextInFilters(excludeKeys, kv.key)) {
  //             return false;
  //           }
  //           // match if key or value matches an item in includeFilters
  //           return isTextInFilters(includeFilters, kv.key) || isTextInFilters(includeFilters, kv.value.toString());
  //         })
  //       : false;

  //   const isSpanAMatch = (span: TraceSpan) =>
  //     isTextInFilters(includeFilters, span.operationName) ||
  //     isTextInFilters(includeFilters, span.process.serviceName) ||
  //     isTextInKeyValues(span.tags) ||
  //     (span.logs !== null && span.logs.some((log) => isTextInKeyValues(log.fields))) ||
  //     isTextInKeyValues(span.process.tags) ||
  //     includeFilters.some((filter) => filter === span.spanID);

  //   // declare as const because need to disambiguate the type
  //   const rv: Set<string> = new Set(spans.filter(isSpanAMatch).map((span: TraceSpan) => span.spanID));
  //   return rv;
  // }

  if (arraysToMatchAcross.length > 0) {
    return new Set([...arraysToMatchAcross].reduce((a, b) => a.filter(c => b.includes(c))));
  } 
  else {
    return new Set(arraysToMatchAcross);
  }
}

const getTagMatches = (spans: TraceSpan[], tags: string) => {
   // if a span field includes at least one filter in includeFilters, the span is a match
   const includeFilters: string[] = [];

   // values with keys that include text in any one of the excludeKeys will be ignored
   const excludeKeys: string[] = [];

   // split textFilter by whitespace, remove empty strings, and extract includeFilters and excludeKeys
   tags
     .split(/\s+/)
     .filter(Boolean)
     .forEach((w) => {
       if (w[0] === '-') {
         excludeKeys.push(w.slice(1).toLowerCase());
       } else {
         includeFilters.push(w.toLowerCase());
       }
     });

   const isTextInFilters = (filters: string[], text: string) => filters.some((filter) => text.toLowerCase().includes(filter));
   const isTextInKeyValues = (kvs: TraceKeyValuePair[]) => {
     return kvs.some((kv) => {
       // ignore checking key and value for a match if key is in excludeKeys
       if (isTextInFilters(excludeKeys, kv.key)) {
         return false;
       }

       const match = includeFilters.some((filter) => {
         if (filter.includes('=')) {
           // match if key and value matches an item in includeFilters
           const a = `${kv.key}=${kv.value}`.toLowerCase().includes(filter);
           if (a) {  
             // console.log('f=', filter, kv);
           }
           return a;
         } else {
           // match if key or value matches an item in includeFilters
           const b = kv.key.toLowerCase().includes(filter) || kv.value.toString().toLowerCase().includes(filter);
           if (b) {  
             // console.log('f', filter, kv);
           }
           return b;
         }
       });

       return match;
     })
   }

   const areTagsAMatch = (span: TraceSpan) =>
     isTextInKeyValues(span.tags) ||
     (span.logs !== null && span.logs.some((log) => isTextInKeyValues(log.fields))) ||
     isTextInKeyValues(span.process.tags) ||
     includeFilters.some((filter) => filter === span.spanID)

   return spans.filter(areTagsAMatch).map((span: TraceSpan) => span.spanID)
}

const getServiceNameMatches = (spans: TraceSpan[], serviceName: string) => {
  return spans.filter((span: TraceSpan) => {
    return span.process.serviceName === serviceName;
  }).map((span: TraceSpan) => span.spanID);
}

const getSpanNameMatches = (spans: TraceSpan[], spanName: string) => {
  return spans.filter((span: TraceSpan) => {
    return span.operationName === spanName;
  }).map((span: TraceSpan) => span.spanID);
}
