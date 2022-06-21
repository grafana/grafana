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

import { render, screen, within } from '@testing-library/react';
import React from 'react';

import GraphTicks from './GraphTicks';

const setup = (propOverrides) => {
  const defaultProps = {
    items: [
      { valueWidth: 100, valueOffset: 25, serviceName: 'a' },
      { valueWidth: 100, valueOffset: 50, serviceName: 'b' },
    ],
    valueWidth: 200,
    numTicks: 4,
    ...propOverrides,
  };

  return render(<GraphTicks {...defaultProps} />);
};

describe('GraphTicks tests', () => {
  it('creates a <g> for ticks', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    setup();

    // Expect ----->  Warning: The tag <line> is unrecognized in this browser. If you meant to render a React component, start its name with an uppercase letter.
    expect(consoleSpy).toHaveBeenCalledTimes(2);

    expect(screen.getByTestId('ticks')).toBeInTheDocument();
  });

  it('creates a line for each ticks excluding the first and last', () => {
    setup({ numTicks: 6 });

    // defaultProps.numTicks - 1 === expect
    expect(screen.getByTestId('ticks').children).toHaveLength(5);
  });
});
