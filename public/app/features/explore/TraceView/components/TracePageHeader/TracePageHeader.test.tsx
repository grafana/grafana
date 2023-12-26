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

import { getByText, render } from '@testing-library/react';
import React from 'react';

import { MutableDataFrame } from '@grafana/data';

import { defaultFilters } from '../../useSearch';

import { TracePageHeader } from './TracePageHeader';

const setup = () => {
  const defaultProps = {
    trace,
    timeZone: '',
    search: defaultFilters,
    setSearch: jest.fn(),
    showSpanFilters: true,
    setShowSpanFilters: jest.fn(),
    showSpanFilterMatchesOnly: false,
    setShowSpanFilterMatchesOnly: jest.fn(),
    showCriticalPathSpansOnly: false,
    setShowCriticalPathSpansOnly: jest.fn(),
    spanFilterMatches: undefined,
    setFocusedSpanIdForSearch: jest.fn(),
    datasourceType: 'tempo',
    setHeaderHeight: jest.fn(),
    data: new MutableDataFrame(),
  };

  return render(<TracePageHeader {...defaultProps} />);
};

describe('TracePageHeader test', () => {
  it('should render the new trace header', () => {
    setup();

    const header = document.querySelector('header');
    const method = getByText(header!, 'POST');
    const status = getByText(header!, '200');
    const url = getByText(header!, '/v2/gamma/792edh2w897y2huehd2h89');
    const duration = getByText(header!, '2.36s');
    const timestampPart1 = getByText(header!, '2023-02-05 08:50');
    const timestampPart2 = getByText(header!, ':56.289');
    expect(method).toBeInTheDocument();
    expect(status).toBeInTheDocument();
    expect(url).toBeInTheDocument();
    expect(duration).toBeInTheDocument();
    expect(timestampPart1).toBeInTheDocument();
    expect(timestampPart2).toBeInTheDocument();
  });
});

export const trace = {
  services: [{ name: 'serviceA', numberOfSpans: 1 }],
  spans: [
    {
      traceID: '164afda25df92413',
      spanID: '264afda25df92413',
      operationName: 'HTTP Client',
      serviceName: 'serviceA',
      subsidiarilyReferencedBy: [],
      startTime: 1675602037286989,
      duration: 5685,
      logs: [],
      references: [],
      tags: [],
      processID: '264afda25df92413',
      flags: 0,
      process: {
        serviceName: 'lb',
        tags: [],
      },
      relativeStartTime: 0,
      depth: 0,
      hasChildren: false,
      childSpanCount: 0,
      warnings: [],
      childSpanIds: [],
    },
    {
      traceID: '164afda25df92413',
      spanID: '364afda25df92413',
      operationName: 'HTTP Client',
      serviceName: 'serviceB',
      subsidiarilyReferencedBy: [],
      startTime: 1675602037286989,
      duration: 5685,
      logs: [],
      references: [],
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: `/v2/gamma/792edh2w897y2huehd2h89`,
        },
        {
          key: 'http.method',
          type: 'String',
          value: `POST`,
        },
        {
          key: 'http.status_code',
          type: 'String',
          value: `200`,
        },
      ],
      processID: '364afda25df92413',
      flags: 0,
      process: {
        serviceName: 'lb',
        tags: [],
      },
      relativeStartTime: 0,
      depth: 0,
      hasChildren: false,
      childSpanCount: 0,
      warnings: [],
      childSpanIds: [],
    },
    {
      traceID: '164afda25df92413',
      spanID: '464afda25df92413',
      operationName: 'HTTP Server',
      serviceName: 'serviceC',
      subsidiarilyReferencedBy: [],
      startTime: 1675602037286989,
      duration: 5685,
      logs: [],
      references: [],
      tags: [
        {
          key: 'http.url',
          type: 'String',
          value: `/v2/gamma/792edh2w897y2huehd2h89`,
        },
        {
          key: 'http.method',
          type: 'String',
          value: `POST`,
        },
        {
          key: 'http.status_code',
          type: 'String',
          value: `200`,
        },
      ],
      processID: '464afda25df92413',
      flags: 0,
      process: {
        serviceName: 'db',
        tags: [],
      },
      relativeStartTime: 0,
      depth: 0,
      hasChildren: false,
      childSpanCount: 0,
      warnings: [],
      childSpanIds: [],
    },
  ],
  traceID: '8bb35a31-eb64-512d-aaed-ddd61887bb2b',
  traceName: 'serviceA: GET',
  processes: {
    '264afda25df92413': {
      serviceName: 'serviceA',
      tags: [],
    },
    '364afda25df92413': {
      serviceName: 'serviceB',
      tags: [],
    },
    '464afda25df92413': {
      serviceName: 'serviceC',
      tags: [],
    },
  },
  duration: 2355515,
  startTime: 1675605056289000,
  endTime: 1675605058644515,
};
