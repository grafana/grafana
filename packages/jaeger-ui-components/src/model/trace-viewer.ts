// Copyright (c) 2020 The Jaeger Authors
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

import { memoize } from 'lodash';

import { TraceSpan } from '../types/trace';

export function _getTraceNameImpl(spans: TraceSpan[]) {
  // Use a span with no references to another span in given array
  // prefering the span with the fewest references
  // using start time as a tie breaker
  let candidateSpan: TraceSpan | undefined;
  const allIDs: Set<string> = new Set(spans.map(({ spanID }) => spanID));

  for (let i = 0; i < spans.length; i++) {
    const hasInternalRef =
      spans[i].references &&
      spans[i].references.some(({ traceID, spanID }) => traceID === spans[i].traceID && allIDs.has(spanID));
    if (hasInternalRef) {
      continue;
    }

    if (!candidateSpan) {
      candidateSpan = spans[i];
      continue;
    }

    const thisRefLength = (spans[i].references && spans[i].references.length) || 0;
    const candidateRefLength = (candidateSpan.references && candidateSpan.references.length) || 0;

    if (
      thisRefLength < candidateRefLength ||
      (thisRefLength === candidateRefLength && spans[i].startTime < candidateSpan.startTime)
    ) {
      candidateSpan = spans[i];
    }
  }
  return candidateSpan ? `${candidateSpan.process.serviceName}: ${candidateSpan.operationName}` : '';
}

export const getTraceName = memoize(_getTraceNameImpl, (spans: TraceSpan[]) => {
  if (!spans.length) {
    return 0;
  }
  return spans[0].traceID;
});
