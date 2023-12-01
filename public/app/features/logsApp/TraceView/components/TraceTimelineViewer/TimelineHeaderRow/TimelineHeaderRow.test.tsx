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
import React from 'react';

import TimelineHeaderRow, { TimelineHeaderRowProps } from './TimelineHeaderRow';

const nameColumnWidth = 0.25;
const setup = () => {
  const props = {
    nameColumnWidth,
    duration: 1234,
    numTicks: 5,
    onCollapseAll: () => {},
    onCollapseOne: () => {},
    onColummWidthChange: () => {},
    onExpandAll: () => {},
    onExpandOne: () => {},
    updateNextViewRangeTime: () => {},
    updateViewRangeTime: () => {},
    viewRangeTime: {
      current: [0.1, 0.9],
    },
  };

  return render(<TimelineHeaderRow {...(props as unknown as TimelineHeaderRowProps)} />);
};

describe('TimelineHeaderRow', () => {
  it('renders without exploding', () => {
    expect(() => setup()).not.toThrow();
  });

  it('renders the title', () => {
    setup();

    expect(screen.getByRole('heading', { name: 'Service & Operation' }));
  });

  it('renders the collapser controls', () => {
    setup();

    expect(screen.getByRole('button', { name: 'Expand All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand +1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse +1' })).toBeInTheDocument();
  });

  it('renders the resizer controls', () => {
    setup();

    expect(screen.getByTestId('TimelineColumnResizer')).toBeInTheDocument();
    expect(screen.getByTestId('TimelineColumnResizer--dragger')).toBeInTheDocument();
    expect(screen.getByTestId('TimelineColumnResizer--gripIcon')).toBeInTheDocument();
  });

  it('propagates the name column width', () => {
    setup();

    const timelineCells = screen.queryAllByTestId('TimelineRowCell');
    expect(timelineCells).toHaveLength(2);
    expect(getComputedStyle(timelineCells[0]).maxWidth).toBe(`${nameColumnWidth * 100}%`);
    expect(getComputedStyle(timelineCells[1]).maxWidth).toBe(`${(1 - nameColumnWidth) * 100}%`);
  });

  it('renders the TimelineViewingLayer', () => {
    setup();

    expect(screen.getByTestId('TimelineViewingLayer')).toBeInTheDocument();
  });

  it('renders the Ticks', () => {
    setup();

    expect(screen.getAllByTestId('TicksID')).toHaveLength(5);
  });
});
