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

import test2 from '../testCases/test2';
import test5 from '../testCases/test5';

import getChildOfSpans from './getChildOfSpans';

describe('getChildOfSpans', () => {
  it('Should not remove CHILD_OF child spans if there are any', () => {
    const spanMap = test2.trace.spans.reduce((map, span) => {
      map.set(span.spanID, span);
      return map;
    }, new Map());
    const refinedSpanMap = getChildOfSpans(spanMap);
    const expectedRefinedSpanMap = spanMap;

    expect(refinedSpanMap.size).toBe(3);
    expect(refinedSpanMap).toStrictEqual(expectedRefinedSpanMap);
  });
  it('Should remove FOLLOWS_FROM child spans if there are any', () => {
    const spanMap = test5.trace.spans.reduce((map, span) => {
      map.set(span.spanID, span);
      return map;
    }, new Map());
    const refinedSpanMap = getChildOfSpans(spanMap);
    const expectedRefinedSpanMap = new Map().set(test5.trace.spans[0].spanID, {
      ...test5.trace.spans[0],
      childSpanIds: [],
    });

    expect(refinedSpanMap.size).toBe(1);
    expect(refinedSpanMap).toStrictEqual(expectedRefinedSpanMap);
  });
});
