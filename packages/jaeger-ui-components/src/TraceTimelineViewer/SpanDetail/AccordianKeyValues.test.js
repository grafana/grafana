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

import AccordianKeyValues, { KeyValuesSummary } from './AccordianKeyValues';

const tags = [
  { key: 'span.kind', value: 'client' },
  { key: 'omg', value: 'mos-def' },
];

const setupAccordian = (propOverrides) => {
  const props = {
    compact: false,
    data: tags,
    isOpen: true,
    label: 'test accordian',
    onToggle: jest.fn(),
    ...propOverrides,
  };
  return render(<AccordianKeyValues {...props} />);
};

const setupKeyValues = (propOverrides) => {
  const props = {
    data: tags,
    ...propOverrides,
  };
  return render(<KeyValuesSummary {...props} />);
};

describe('KeyValuesSummary tests', () => {
  it('renders without exploding', () => {
    expect(() => setupKeyValues()).not.toThrow();
  });

  it('returns `null` when props.data is empty', () => {
    setupKeyValues({ data: null });

    expect(screen.queryAllByRole('table')).toHaveLength(0);
    expect(screen.queryAllByRole('row')).toHaveLength(0);
    expect(screen.queryAllByRole('cell')).toHaveLength(0);
  });

  it('generates a list from `data` with the correct content', () => {
    setupKeyValues();

    expect(screen.queryAllByRole('listitem')).toHaveLength(2);
  });

  it('renders the data as text', () => {
    setupKeyValues();

    expect(screen.getByText(/^span.kind$/)).toBeInTheDocument();
    expect(screen.getByText(/^client$/)).toBeInTheDocument();
    expect(screen.getByText(/^omg$/)).toBeInTheDocument();
    expect(screen.getByText(/^mos-def$/)).toBeInTheDocument();
  });
});

describe('AccordianKeyValues test', () => {
  it('renders without exploding', () => {
    expect(() => setupAccordian()).not.toThrow();
  });

  it('renders the label', () => {
    setupAccordian();

    expect(screen.getByTestId('AccordianKeyValues--header')).toBeInTheDocument();
  });

  it('renders table correctly when passed data & is open ', () => {
    setupAccordian();

    expect(screen.getByRole('switch', { name: 'test accordian' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: 'span.kind "client"' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'span.kind' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '"client"' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'omg' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '"mos-def"' })).toBeInTheDocument();
  });

  it('renders the summary instead of the table when it is not expanded', () => {
    setupAccordian({ isOpen: false });

    expect(
      screen.getByRole('switch', { name: 'test accordian: span.kind = client omg = mos-def' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('cell')).toHaveLength(0);
  });
});
