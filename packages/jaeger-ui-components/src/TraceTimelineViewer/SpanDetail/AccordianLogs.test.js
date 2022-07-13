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

import AccordianLogs from './AccordianLogs';

const logs = [
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

const setup = (propOverrides) => {
  const props = {
    logs,
    isOpen: false,
    onItemToggle: jest.fn(),
    onToggle: () => {},
    openedItems: new Set([logs[1]]),
    timestamp: 5,
    ...propOverrides,
  };

  return render(<AccordianLogs {...props} />);
};

describe('AccordianLogs tests', () => {
  it('renders without exploding', () => {
    expect(() => setup()).not.toThrow();
  });

  it('shows the number of log entries', () => {
    setup();

    expect(screen.getByRole('switch', { name: 'Events (2)' })).toBeInTheDocument();
  });

  it('hides log entries when not expanded', () => {
    setup({ isOpen: false });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows log entries when expanded', () => {
    setup({ isOpen: true });

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryAllByRole('cell')).toHaveLength(6);
    expect(screen.getByText(/^something$/)).toBeInTheDocument();
    expect(screen.getByText(/^else$/)).toBeInTheDocument();
  });
});
