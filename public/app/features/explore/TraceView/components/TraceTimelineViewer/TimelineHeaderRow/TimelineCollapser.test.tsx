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

import { TimelineCollapser } from './TimelineCollapser';

const setup = () => {
  const props = {
    onCollapseAll: () => {},
    onCollapseOne: () => {},
    onExpandAll: () => {},
    onExpandOne: () => {},
  };
  return render(<TimelineCollapser {...props} />);
};

describe('TimelineCollapser test', () => {
  it('renders without exploding', () => {
    expect(() => setup()).not.toThrow();
  });

  it('renders correctly', () => {
    setup();

    expect(screen.getByTestId('TimelineCollapser')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand all' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse all' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand +1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse +1' })).toBeInTheDocument();
  });
});
