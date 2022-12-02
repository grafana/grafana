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

jest.mock('../utils');

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import traceGenerator from '../../demo/trace-generators';
import transformTraceData from '../../model/transform-trace-data';
import { formatDuration } from '../utils';

import DetailState from './DetailState';

import SpanDetail, { getAbsoluteTime } from './index';

describe('<SpanDetail>', () => {
  // use `transformTraceData` on a fake trace to get a fully processed span
  const span = transformTraceData(traceGenerator.trace({ numberOfSpans: 1 })).spans[0];
  const detailState = new DetailState().toggleLogs().toggleProcess().toggleReferences().toggleTags();
  const traceStartTime = 5;
  const topOfExploreViewRef = jest.fn();
  const props = {
    detailState,
    span,
    traceStartTime,
    topOfExploreViewRef,
    logItemToggle: jest.fn(),
    logsToggle: jest.fn(),
    processToggle: jest.fn(),
    tagsToggle: jest.fn(),
    warningsToggle: jest.fn(),
    referencesToggle: jest.fn(),
    createFocusSpanLink: jest.fn().mockReturnValue({}),
    topOfViewRefType: 'Explore',
  };
  span.logs = [
    {
      timestamp: 10,
      fields: [
        { key: 'message', value: 'oh the log message' },
        { key: 'something', value: 'else' },
      ],
    },
    {
      timestamp: 20,
      fields: [
        { key: 'message', value: 'oh the next log message' },
        { key: 'more', value: 'stuff' },
      ],
    },
  ];

  span.warnings = ['Warning 1', 'Warning 2'];

  span.references = [
    {
      refType: 'CHILD_OF',
      span: {
        spanID: 'span2',
        traceID: 'trace1',
        operationName: 'op1',
        process: {
          serviceName: 'service1',
        },
      },
      spanID: 'span1',
      traceID: 'trace1',
    },
    {
      refType: 'CHILD_OF',
      span: {
        spanID: 'span3',
        traceID: 'trace1',
        operationName: 'op2',
        process: {
          serviceName: 'service2',
        },
      },
      spanID: 'span4',
      traceID: 'trace1',
    },
    {
      refType: 'CHILD_OF',
      span: {
        spanID: 'span6',
        traceID: 'trace2',
        operationName: 'op2',
        process: {
          serviceName: 'service2',
        },
      },
      spanID: 'span5',
      traceID: 'trace2',
    },
  ];

  beforeEach(() => {
    formatDuration.mockReset();
    props.tagsToggle.mockReset();
    props.processToggle.mockReset();
    props.logsToggle.mockReset();
    props.logItemToggle.mockReset();
  });

  it('renders without exploding', () => {
    expect(() => render(<SpanDetail {...props} />)).not.toThrow();
  });

  it('shows the operation name', () => {
    render(<SpanDetail {...props} />);
    expect(screen.getByRole('heading', { name: span.operationName })).toBeInTheDocument();
  });

  it('lists the service name, duration and start time', () => {
    render(<SpanDetail {...props} />);
    expect(screen.getByText('Duration:')).toBeInTheDocument();
    expect(screen.getByText('Service:')).toBeInTheDocument();
    expect(screen.getByText('Start Time:')).toBeInTheDocument();
  });

  it('start time shows the absolute time', () => {
    render(<SpanDetail {...props} />);
    const absoluteTime = getAbsoluteTime(span.startTime);
    expect(
      screen.getByText((text) => {
        return text.includes(absoluteTime);
      })
    ).toBeInTheDocument();
  });

  it('renders the span tags', async () => {
    render(<SpanDetail {...props} />);
    await userEvent.click(screen.getByRole('switch', { name: /Attributes/ }));
    expect(props.tagsToggle).toHaveBeenLastCalledWith(span.spanID);
  });

  it('renders the process tags', async () => {
    render(<SpanDetail {...props} />);
    await userEvent.click(screen.getByRole('switch', { name: /Resource/ }));
    expect(props.processToggle).toHaveBeenLastCalledWith(span.spanID);
  });

  it('renders the logs', async () => {
    render(<SpanDetail {...props} />);
    await userEvent.click(screen.getByRole('switch', { name: /Events/ }));
    expect(props.logsToggle).toHaveBeenLastCalledWith(span.spanID);
    await userEvent.click(screen.getByRole('switch', { name: /oh the log/ }));
    expect(props.logItemToggle).toHaveBeenLastCalledWith(span.spanID, props.span.logs[0]);
  });

  it('renders the warnings', async () => {
    render(<SpanDetail {...props} />);
    await userEvent.click(screen.getByRole('switch', { name: /Warnings/ }));
    expect(props.warningsToggle).toHaveBeenLastCalledWith(span.spanID);
  });

  it('renders the references', async () => {
    render(<SpanDetail {...props} />);
    await userEvent.click(screen.getByRole('switch', { name: /References/ }));
    expect(props.referencesToggle).toHaveBeenLastCalledWith(span.spanID);
  });

  it('renders deep link URL', () => {
    render(<SpanDetail {...props} />);
    expect(document.getElementsByTagName('a').length).toBeGreaterThan(1);
  });
});
