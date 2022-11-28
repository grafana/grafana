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

import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';

import Scrubber from './Scrubber';

describe('<Scrubber>', () => {
  const defaultProps = {
    position: 0,
  };

  let rerender;

  beforeEach(() => {
    ({ rerender } = render(
      <svg>
        <Scrubber {...defaultProps} />
      </svg>
    ));
  });

  it('contains the proper svg components', () => {
    const scrubberComponent = screen.getByTestId('scrubber-component');
    const scrubberComponentG = screen.getByTestId('scrubber-component-g');

    expect(within(scrubberComponent).getByTestId('scrubber-component-g')).toBeTruthy();
    expect(within(scrubberComponent).getByTestId('scrubber-component-line')).toBeTruthy();
    expect(within(scrubberComponentG).getByTestId('scrubber-component-rect-1')).toBeTruthy();
    expect(within(scrubberComponentG).getByTestId('scrubber-component-rect-2')).toBeTruthy();
  });

  it('calculates the correct x% for a timestamp', () => {
    rerender(
      <svg>
        <Scrubber {...defaultProps} position={0.5} />
      </svg>
    );
    const line = screen.getByTestId('scrubber-component-line');
    const rect = screen.getByTestId('scrubber-component-rect-1');

    expect(line).toHaveAttribute('x1', '50%');
    expect(line).toHaveAttribute('x2', '50%');
    expect(rect).toHaveAttribute('x', '50%');
  });

  it('supports onMouseDown', () => {
    expect(fireEvent.mouseDown(screen.getByTestId('scrubber-component-g'))).toBeTruthy();
  });
});
