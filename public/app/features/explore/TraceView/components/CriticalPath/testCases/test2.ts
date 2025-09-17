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

/*                                                       |
 ┌─────────────────────────────────────────────────┐     |
 │                      Span X                     │     |
 └──────┬───────┬─────────────────▲──────▲─────────┘     |
 +++++++│+++++++│                 │      |++++++++++     |            span X
        ▼───────┼─────────────────┤      |               |           /     \
        │       │ Span A          │      |               |          /       \
        └───────┼─────────────────┘      |               |      span A     span C
                │                        |               |
                │                        |               |
                ▼────────────────────────┤               |     (parent-child tree)
                │         Span C         │               |
                └────────────────────────┘               |
                ++++++++++++++++++++++++++               |
                                                         |
Here ++++++ is critical path                             |
*/
import transformTraceData from '../../model/transform-trace-data';
import { TraceResponse } from '../../types/trace';

const happyTrace: TraceResponse = {
  traceID: 'trace-123',
  spans: [
    {
      traceID: 'trace-123',
      spanID: 'span-X',
      operationName: 'op1',
      startTime: 1,
      duration: 100,
      references: [],
      processID: 'p1',
      logs: [],
      flags: 0,
    },
    {
      traceID: 'trace-123',
      spanID: 'span-A',
      operationName: 'op2',
      startTime: 10,
      duration: 40,
      references: [
        {
          refType: 'CHILD_OF',
          spanID: 'span-X',
          traceID: 'trace-123',
        },
      ],
      processID: 'p1',
      logs: [],
      flags: 0,
    },
    {
      traceID: 'trace-123',
      spanID: 'span-C',
      operationName: 'op3',
      startTime: 20,
      duration: 40,
      references: [
        {
          refType: 'CHILD_OF',
          spanID: 'span-X',
          traceID: 'trace-123',
        },
      ],
      processID: 'p1',
      logs: [],
      flags: 0,
    },
  ],
  processes: {
    p1: {
      serviceName: 'service1',
      tags: [],
    },
  },
};

const transformedTrace = transformTraceData(happyTrace)!;

const criticalPathSections = [
  {
    spanId: 'span-X',
    section_start: 60,
    section_end: 101,
  },
  {
    spanId: 'span-C',
    section_start: 20,
    section_end: 60,
  },
  {
    spanId: 'span-X',
    section_start: 1,
    section_end: 20,
  },
];

const test2 = {
  criticalPathSections,
  trace: transformedTrace,
};

export default test2;
