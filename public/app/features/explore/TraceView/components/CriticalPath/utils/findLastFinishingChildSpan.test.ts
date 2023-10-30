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

import test1 from '../testCases/test1';
import test2 from '../testCases/test2';

import findLastFinishingChildSpanId from './findLastFinishingChildSpan';
import getChildOfSpans from './getChildOfSpans';
import sanitizeOverFlowingChildren from './sanitizeOverFlowingChildren';

describe('findLastFinishingChildSpanId', () => {
  it('Should find lfc of a span correctly', () => {
    const refinedSpanData = getChildOfSpans(new Map(test1.trace.spans.map((span) => [span.spanID, span])));
    const sanitizedSpanMap = sanitizeOverFlowingChildren(refinedSpanData);

    const currentSpan = sanitizedSpanMap.get('span-C')!;
    let lastFinishingChildSpan = findLastFinishingChildSpanId(sanitizedSpanMap, currentSpan);
    expect(lastFinishingChildSpan).toStrictEqual(sanitizedSpanMap.get('span-E'));

    // Second Case to check if it works with spawn time or not
    lastFinishingChildSpan = findLastFinishingChildSpanId(sanitizedSpanMap, currentSpan, 50);
    expect(lastFinishingChildSpan).toStrictEqual(sanitizedSpanMap.get('span-D'));
  });

  it('Should find lfc of a span correctly', () => {
    const refinedSpanData = getChildOfSpans(new Map(test2.trace.spans.map((span) => [span.spanID, span])));
    const sanitizedSpanMap = sanitizeOverFlowingChildren(refinedSpanData);

    const currentSpan = sanitizedSpanMap.get('span-X')!;
    let lastFinishingChildSpanId = findLastFinishingChildSpanId(sanitizedSpanMap, currentSpan);
    expect(lastFinishingChildSpanId).toStrictEqual(sanitizedSpanMap.get('span-C'));

    // Second Case to check if it works with spawn time or not
    lastFinishingChildSpanId = findLastFinishingChildSpanId(sanitizedSpanMap, currentSpan, 20);
    expect(lastFinishingChildSpanId).toBeUndefined();
  });
});
