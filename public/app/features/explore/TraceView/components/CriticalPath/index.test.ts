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

import transformTraceData from '../model/transform-trace-data';
import { type TraceResponse } from '../types/trace';

import test1 from './testCases/test1';
import test2 from './testCases/test2';
import test3 from './testCases/test3';
import test4 from './testCases/test4';
import test5 from './testCases/test5';
import test6 from './testCases/test6';
import test7 from './testCases/test7';
import test8 from './testCases/test8';
import test9 from './testCases/test9';

import TraceCriticalPath from './index';

describe.each([[test1], [test2], [test3], [test4], [test5], [test6], [test7], [test8], [test9]])(
  'Happy Path',
  (testProps) => {
    it('should find criticalPathSections correctly', () => {
      const criticalPath = TraceCriticalPath(testProps.trace);
      expect(criticalPath).toStrictEqual(testProps.criticalPathSections);
    });
  }
);

describe('Trace without spans', () => {
  it('should return an empty critical path', () => {
    expect(TraceCriticalPath({ ...test1.trace, spans: [] })).toStrictEqual([]);
  });
});

describe('Traces with cyclic or unresolved span references', () => {
  const traceID = 'cyclic-trace';
  const ref = (refType: 'CHILD_OF' | 'FOLLOWS_FROM', spanID: string) => ({ refType, traceID, spanID });
  const makeSpan = (
    spanID: string,
    startTime: number,
    duration: number,
    references: Array<ReturnType<typeof ref>>
  ) => ({
    traceID,
    spanID,
    operationName: spanID,
    references,
    startTime,
    duration,
    processID: 'p1',
  });
  const criticalPathOf = (spans: Array<ReturnType<typeof makeSpan>>) => {
    const processes = { p1: { serviceName: 'serviceName', tags: [] } };
    return TraceCriticalPath(transformTraceData({ traceID, processes, spans } as unknown as TraceResponse)!);
  };
  const children = [
    makeSpan('child-1', 200, 100, [ref('CHILD_OF', 'root')]),
    makeSpan('child-2', 400, 100, [ref('CHILD_OF', 'root')]),
  ];
  const sectionsThroughBothChildren = [
    { spanId: 'root', section_start: 500, section_end: 1100 },
    { spanId: 'child-2', section_start: 400, section_end: 500 },
    { spanId: 'root', section_start: 300, section_end: 400 },
    { spanId: 'child-1', section_start: 200, section_end: 300 },
    { spanId: 'root', section_start: 100, section_end: 200 },
  ];

  it.each([
    { name: 'the root links to its own child', references: [ref('FOLLOWS_FROM', 'child-2')] },
    { name: 'the root links to a span outside the trace', references: [ref('FOLLOWS_FROM', 'elsewhere')] },
  ])('runs through the children of the root when $name', ({ references }) => {
    expect(criticalPathOf([makeSpan('root', 100, 1000, references), ...children])).toStrictEqual(
      sectionsThroughBothChildren
    );
  });

  it('visits each span of a CHILD_OF cycle once', () => {
    const criticalPath = criticalPathOf([
      makeSpan('a', 100, 1000, [ref('CHILD_OF', 'b')]),
      makeSpan('b', 200, 1000, [ref('CHILD_OF', 'a')]),
    ]);

    expect(criticalPath).toStrictEqual([
      { spanId: 'b', section_start: 200, section_end: 1100 },
      { spanId: 'a', section_start: 100, section_end: 200 },
    ]);
  });
});
