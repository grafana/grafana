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
           ┌────────────────────────────┐           |
           │        Span A              │           |
           └────────────┬───────────────┘           |               span A
                        │                           |               /
                       ┌▼──────────────────────┐    |              /
                       │      Span B           │    |             span B
                       └──────────▲────────────┘    |             /
                                  │                 |            /
                   ┌──────────────┤                 |           span C
                   │   Span C     │                 |
                   └──────────────┘                 |       (parent-child tree)
*/

import { TraceResponse, transformTraceData } from '../../index';

const trace: TraceResponse = {
  traceID: 'trace-abc',
  spans: [
    {
      traceID: 'trace-abc',
      spanID: 'span-A',
      operationName: 'op-A',
      references: [],
      startTime: 1,
      duration: 29,
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
      startTime: 15,
      duration: 20,
      processID: 'p1',
      logs: [],
      flags: 0,
    },
    {
      traceID: 'trace-abc',
      spanID: 'span-C',
      operationName: 'op-C',
      references: [
        {
          refType: 'CHILD_OF',
          spanID: 'span-B',
          traceID: 'trace-abc',
        },
      ],
      startTime: 10,
      duration: 15,
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
    spanId: 'span-B',
    section_start: 25,
    section_end: 30,
  },
  {
    spanId: 'span-C',
    section_start: 15,
    section_end: 25,
  },
  {
    spanId: 'span-A',
    section_start: 1,
    section_end: 15,
  },
];

const test6 = {
  criticalPathSections,
  trace: transformedTrace,
};

export default test6;
