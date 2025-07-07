// Copyright (c) 2023 The Jaeger Authors
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

import { TraceSpan } from '../../types/trace';

/**
 * @returns - Returns the span that finished last among the remaining child spans.
 * If a `returningChildStartTime` is provided as a parameter, it returns the child span that finishes
 * just before the specified `returningChildStartTime`.
 */
const findLastFinishingChildSpan = (
  spanMap: Map<string, TraceSpan>,
  currentSpan: TraceSpan,
  returningChildStartTime?: number
): TraceSpan | undefined => {
  let lastFinishingChildSpanId: string | undefined;
  if (returningChildStartTime) {
    lastFinishingChildSpanId = currentSpan?.childSpanIds.find(
      (each) =>
        // Look up the span using the map
        spanMap.has(each) && spanMap.get(each)!.startTime + spanMap.get(each)!.duration < returningChildStartTime
    );
  } else {
    // If `returningChildStartTime` is not provided, select the first child span.
    // As they are sorted based on endTime
    lastFinishingChildSpanId = currentSpan.childSpanIds[0];
  }
  return lastFinishingChildSpanId ? spanMap.get(lastFinishingChildSpanId) : undefined;
};

export default findLastFinishingChildSpan;
