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
import userEvent from '@testing-library/user-event';

import { createTheme } from '@grafana/data';

import traceGenerator from '../demo/trace-generators';
import transformTraceData from '../model/transform-trace-data';

import TraceTimelineViewer, { TProps } from './index';

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    reportInteraction: jest.fn(),
  };
});

describe('<TraceTimelineViewer>', () => {
  const trace = transformTraceData(traceGenerator.trace({}));
  const props = {
    trace,
    textFilter: null,
    viewRange: {
      time: {
        current: [0, 1],
      },
    },
    traceTimeline: {
      childrenHiddenIDs: new Set(),
      hoverIndentGuideIds: new Set(),
      spanNameColumnWidth: 0.5,
      detailStates: new Map(),
    },
    expandAll: jest.fn(),
    collapseAll: jest.fn(),
    expandOne: jest.fn(),
    collapseOne: jest.fn(),
    theme: createTheme(),
    history: {
      replace: () => {},
    },
    location: {
      search: null,
    },
  };

  it('it does not explode', () => {
    expect(() => render(<TraceTimelineViewer {...(props as unknown as TProps)} />)).not.toThrow();
  });

  it('it sets up actions', async () => {
    render(<TraceTimelineViewer {...(props as unknown as TProps)} />);

    const expandOne = screen.getByRole('button', { name: 'Expand +1' });
    const collapseOne = screen.getByRole('button', { name: 'Collapse +1' });
    const expandAll = screen.getByRole('button', { name: 'Expand all' });
    const collapseAll = screen.getByRole('button', { name: 'Collapse all' });

    expect(expandOne).toBeInTheDocument();
    expect(collapseOne).toBeInTheDocument();
    expect(expandAll).toBeInTheDocument();
    expect(collapseAll).toBeInTheDocument();

    await userEvent.click(expandOne);
    expect(props.expandOne).toHaveBeenCalled();

    await userEvent.click(collapseOne);
    expect(props.collapseOne).toHaveBeenCalled();

    await userEvent.click(expandAll);
    expect(props.expandAll).toHaveBeenCalled();

    await userEvent.click(collapseAll);
    expect(props.collapseAll).toHaveBeenCalled();
  });
});
