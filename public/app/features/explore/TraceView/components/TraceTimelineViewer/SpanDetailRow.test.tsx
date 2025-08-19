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

import { render, screen } from '@testing-library/react';

import { createTheme } from '@grafana/data';
import { setPluginLinksHook } from '@grafana/runtime';

import DetailState from './SpanDetail/DetailState';
import { UnthemedSpanDetailRow, SpanDetailRowProps } from './SpanDetailRow';

const testSpan = {
  spanID: 'testSpanID',
  traceID: 'testTraceID',
  depth: 3,
  tags: [],
  process: {
    serviceName: 'some-service',
    tags: [{ key: 'tag-key', value: 'tag-value' }],
  },
};
const setup = (propOverrides?: SpanDetailRowProps) => {
  const props = {
    color: 'some-color',
    columnDivision: 0.5,
    detailState: new DetailState(),
    onDetailToggled: jest.fn(),
    isFilteredOut: false,
    logItemToggle: jest.fn(),
    logsToggle: jest.fn(),
    processToggle: jest.fn(),
    createFocusSpanLink: jest.fn(),
    hoverIndentGuideIds: new Map(),
    span: testSpan,
    tagsToggle: jest.fn(),
    traceStartTime: 1000,
    theme: createTheme(),
    traceFlameGraphs: {},
    timeRange: {
      raw: {
        from: 0,
        to: 1000000000000,
      },
    },
    ...propOverrides,
  };
  return render(<UnthemedSpanDetailRow {...(props as SpanDetailRowProps)} />);
};

describe('SpanDetailRow tests', () => {
  beforeEach(() => {
    setPluginLinksHook(() => ({
      isLoading: false,
      links: [],
    }));
  });

  it('renders without exploding', () => {
    expect(() => setup()).not.toThrow();
  });

  it('renders the SpanDetail', () => {
    setup();

    expect(screen.getByTestId('span-detail-component')).toBeInTheDocument();
  });
});
