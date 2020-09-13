// Copyright (c) 2017 Uber Technologies, Inc.
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

// See https://github.com/jaegertracing/jaeger-ui/issues/115 for details.

export const followsFromRef = {
  processes: {
    p1: {
      serviceName: 'issue115',
      tags: [],
    },
  },
  spans: [
    {
      duration: 1173,
      flags: 1,
      logs: [],
      operationName: 'thread',
      processID: 'p1',
      references: [
        {
          refType: 'FOLLOWS_FROM',
          spanID: 'ea7cfaca83f0724b',
          traceID: '2992f2a5b5d037a8aabffd08ef384237',
        },
      ],
      spanID: '1bdf4201221bb2ac',
      startTime: 1509533706521220,
      tags: [],
      traceID: '2992f2a5b5d037a8aabffd08ef384237',
      warnings: null,
    },
    {
      duration: 70406,
      flags: 1,
      logs: [],
      operationName: 'demo',
      processID: 'p1',
      references: [],
      spanID: 'ea7cfaca83f0724b',
      startTime: 1509533706470949,
      tags: [],
      traceID: '2992f2a5b5d037a8aabffd08ef384237',
      warnings: null,
    },
  ],
  traceID: '2992f2a5b5d037a8aabffd08ef384237',
  warnings: null,
};
