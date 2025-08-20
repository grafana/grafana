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
                                                  |
      ┌──────────┐                                |
      │ Span A   │                                |          span A
      └──────────┘                                |           /
      ++++++++++++    ┌───────────────────┐       |          /
                      │      Span B       │       |      span B
                      └───────────────────┘       |
                                                  |   (parent-child tree)
                                                  |
Span B will be dropped.                           |
span A is on critical path(+++++)                 |
*/

import transformTraceData from '../../model/transform-trace-data';
import { TraceResponse } from '../../types/trace';

const trace: TraceResponse = {
  traceID: '006c3cf93508f205',
  spans: [
    {
      traceID: '006c3cf93508f205',
      spanID: '006c3cf93508f205',
      flags: 1,
      operationName: 'send',
      references: [],
      startTime: 1679437737490189,
      duration: 36,
      tags: [
        {
          key: 'span.kind',
          type: 'string',
          value: 'producer',
        },
      ],
      logs: [],
      processID: 'p1',
      warnings: null,
    },
    {
      traceID: '006c3cf93508f205',
      spanID: '2dc4b796e2127e32',
      flags: 1,
      operationName: 'async task 1',
      references: [
        {
          refType: 'CHILD_OF',
          traceID: '006c3cf93508f205',
          spanID: '006c3cf93508f205',
        },
      ],
      startTime: 1679437737491529,
      duration: 79182,
      tags: [
        {
          key: 'span.kind',
          type: 'string',
          value: 'client',
        },
        {
          key: 'http.method',
          type: 'string',
          value: 'POST',
        },
      ],
      logs: [],
      processID: 'p2',
      warnings: null,
    },
  ],
  processes: {
    p1: {
      serviceName: 'service-one',
      tags: [],
    },
    p2: {
      serviceName: 'service-two',
      tags: [],
    },
  },
  warnings: null,
};

const transformedTrace = transformTraceData(trace)!;
const traceStart = 1679437737490189;

const criticalPathSections = [
  {
    spanId: '006c3cf93508f205',
    section_start: traceStart,
    section_end: traceStart + 36,
  },
];

const test3 = {
  criticalPathSections,
  trace: transformedTrace,
};

export default test3;
