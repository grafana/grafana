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

/*
    ┌──────────┐                         |
    │ Span A   │                         |
    └──────────┘                         |
    ++++++++++++  ┌────────────┐         |              span A
                  │  Span B    │         |              /
                  └┬───────▲───┘         |             /
                   │       │             |           span B
                   │       │             |            /
                   ▼───────┤             |           /
                   │Span C │             |         span C
                   └───────┘             |
                                         |   (parent-child tree)
Both spanB and spanC will be dropped.    |
span A is on critical path(+++++)        |
*/

import transformTraceData from '../../model/transform-trace-data';
import { TraceResponse } from '../../types/trace';

const trace: TraceResponse = {
  traceID: 'trace-abc',
  spans: [
    {
      traceID: 'trace-abc',
      spanID: 'span-A',
      operationName: 'op-A',
      references: [],
      startTime: 1,
      duration: 30,
      processID: 'p1',
      logs: [],
      flags: 0,
    },
    {
      traceID: 'trace-abc',
      spanID: 'span-B',
      operationName: 'op-B',
      references: [
        {
          refType: 'CHILD_OF',
          spanID: 'span-A',
          traceID: 'trace-abc',
        },
      ],
      startTime: 40,
      duration: 40,
      processID: 'p1',
      logs: [],
      flags: 0,
    },
    {
      traceID: 'trace-abc',
      spanID: 'span-c',
      operationName: 'op-C',
      references: [
        {
          refType: 'CHILD_OF',
          spanID: 'span-B',
          traceID: 'trace-abc',
        },
      ],
      startTime: 50,
      duration: 10,
      processID: 'p1',
      logs: [],
      flags: 0,
    },
  ],
  processes: {
    p1: {
      serviceName: 'service-one',
      tags: [],
    },
  },
};

const transformedTrace = transformTraceData(trace)!;

const criticalPathSections = [
  {
    spanId: 'span-A',
    section_start: 1,
    section_end: 31,
  },
];

const test4 = {
  criticalPathSections,
  trace: transformedTrace,
};

export default test4;
