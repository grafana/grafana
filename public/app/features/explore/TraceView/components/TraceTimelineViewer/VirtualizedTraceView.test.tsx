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

import traceGenerator from '../demo/trace-generators';
import transformTraceData from '../model/transform-trace-data';
import { Trace } from '../types/trace';
import { formatDuration } from '../utils/date';

import SpanTreeOffset from './SpanTreeOffset';
import VirtualizedTraceView, { VirtualizedTraceViewProps } from './VirtualizedTraceView';

jest.mock('./SpanTreeOffset');

const trace = transformTraceData(traceGenerator.trace({ numberOfSpans: 2 }))!;

let props = {
  childrenHiddenIDs: new Set(),
  childrenToggle: jest.fn(),
  currentViewRangeTime: [0.25, 0.75],
  detailLogItemToggle: jest.fn(),
  detailLogsToggle: jest.fn(),
  detailProcessToggle: jest.fn(),
  detailStates: new Map(),
  detailTagsToggle: jest.fn(),
  detailToggle: jest.fn(),
  findMatchesIDs: null,
  setSpanNameColumnWidth: jest.fn(),
  spanNameColumnWidth: 0.5,
  trace,
  uiFind: 'uiFind',
  topOfViewRef: jest.fn(),
} as unknown as VirtualizedTraceViewProps;

describe('<VirtualizedTraceViewImpl>', () => {
  beforeEach(() => {
    jest.mocked(SpanTreeOffset).mockReturnValue(<div />);
    let key: keyof VirtualizedTraceViewProps;
    for (key in props) {
      if (typeof props[key] === 'function') {
        (props[key] as jest.Mock).mockReset();
      }
    }
  });

  it('renders service name, operation name and duration for each span', () => {
    render(<VirtualizedTraceView {...props} />);
    expect(screen.getAllByText(trace.services[0].name)).toBeTruthy();

    if (trace.services.length > 1) {
      expect(screen.getAllByText(trace.services[1].name)).toBeTruthy();
    }

    expect(screen.getAllByText(trace.spans[0].operationName)).toBeTruthy();
    expect(screen.getAllByText(trace.spans[1].operationName)).toBeTruthy();

    let durationSpan = formatDuration(trace.spans[0].duration);
    expect(screen.getAllByText(durationSpan)).toBeTruthy();
  });

  it('renders without exploding', () => {
    render(<VirtualizedTraceView {...props} />);
    expect(screen.getByTestId('ListView')).toBeInTheDocument();
    expect(screen.getByTitle('Scroll to top')).toBeInTheDocument();
  });

  it('renders when a trace is not set', () => {
    props = { ...props, trace: null as unknown as Trace };
    render(<VirtualizedTraceView {...props} />);
    expect(screen.getByTestId('ListView')).toBeInTheDocument();
    expect(screen.getByTitle('Scroll to top')).toBeInTheDocument();
  });

  it('renders ListView', () => {
    render(<VirtualizedTraceView {...props} />);
    expect(screen.getByTestId('ListView')).toBeInTheDocument();
  });

  it('renders scrollToTopButton', () => {
    render(<VirtualizedTraceView {...props} />);
    expect(
      screen.getByRole('button', {
        name: /Scroll to top/i,
      })
    ).toBeInTheDocument();
  });
});
