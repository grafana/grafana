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

import { getAllByTestId, render, screen } from '@testing-library/react';
import React from 'react';

import traceGenerator from '../../demo/trace-generators';
import transformTraceData from '../../model/transform-trace-data';
import { polyfill as polyfillAnimationFrame } from '../../utils/test/requestAnimationFrame';

import SpanGraph, { SpanGraphProps, TIMELINE_TICK_INTERVAL } from './index';

describe('<SpanGraph>', () => {
  polyfillAnimationFrame(window);

  const trace = transformTraceData(traceGenerator.trace({}))!;
  const props = {
    trace,
    updateViewRangeTime: () => {},
    viewRange: {
      time: {
        current: [0, 1],
      },
    },
  };

  beforeEach(() => {
    render(<SpanGraph {...(props as unknown as SpanGraphProps)} />);
  });

  it('renders <CanvasSpanGraph />', () => {
    const canvasSpanGraphComponent = screen.getByTestId('CanvasSpanGraph');
    expect(canvasSpanGraphComponent).toBeTruthy();
  });

  it('renders <TickLabels />', () => {
    const tickLabelsComponent = screen.getByTestId('TickLabels');
    expect(tickLabelsComponent).toBeTruthy();
  });

  it('returns an empty div if a trace is not provided', () => {
    const { container } = render(<SpanGraph {...({ ...props, trace: null } as unknown as SpanGraphProps)} />);
    expect(container.firstChild).toBeEmptyDOMElement();
  });

  it('renders <TickLabels /> with the correct numnber of ticks', async () => {
    const tickLabelsDiv = screen.getByTestId('TickLabels');
    expect(getAllByTestId(tickLabelsDiv, 'tick').length).toBe(TIMELINE_TICK_INTERVAL + 1);
  });
});
