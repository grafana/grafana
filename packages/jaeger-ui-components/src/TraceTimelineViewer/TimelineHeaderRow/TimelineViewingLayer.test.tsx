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

import TimelineViewingLayer from './TimelineViewingLayer';

describe('<TimelineViewingLayer>', () => {
  const viewStart = 0.25;
  const viewEnd = 0.9;
  const props = {
    boundsInvalidator: Math.random(),
    updateNextViewRangeTime: jest.fn(),
    updateViewRangeTime: jest.fn(),
    viewRangeTime: {
      current: [viewStart, viewEnd] as [number, number],
    },
  };

  beforeEach(() => {
    render(<TimelineViewingLayer {...props} />);
  });

  it('renders without exploding', () => {
    expect(screen.getByTestId('TimelineViewingLayer')).toBeTruthy();
  });

  describe('render()', () => {
    it('renders nothing without a nextViewRangeTime', () => {
      expect(screen.queryByTestId('TimelineViewingLayer--cursorGuide')).not.toBeInTheDocument();
    });
  });
});
