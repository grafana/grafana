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

import { defaultFilters } from '../../useSearch';

import NewTracePageSearchBar, { TracePageSearchBarProps } from './NewTracePageSearchBar';

const defaultProps = {
  search: defaultFilters,
  setFocusedSpanIdForSearch: jest.fn(),
};

describe('<NewTracePageSearchBar>', () => {
  it('renders buttons', () => {
    render(<NewTracePageSearchBar {...(defaultProps as unknown as TracePageSearchBarProps)} />);
    const nextResButton = screen.getByRole('button', { name: 'Next result button' });
    const prevResButton = screen.getByRole('button', { name: 'Prev result button' });
    const resetFiltersButton = screen.getByRole('button', { name: 'Reset filters button' });
    expect(nextResButton).toBeInTheDocument();
    expect(prevResButton).toBeInTheDocument();
    expect(resetFiltersButton).toBeInTheDocument();
    expect((nextResButton as HTMLButtonElement)['disabled']).toBe(true);
    expect((prevResButton as HTMLButtonElement)['disabled']).toBe(true);
    expect((resetFiltersButton as HTMLButtonElement)['disabled']).toBe(true);
  });

  it('renders buttons that can be used to search if results found', () => {
    const props = {
      ...defaultProps,
      spanFilterMatches: new Set(['2ed38015486087ca']),
    };
    render(<NewTracePageSearchBar {...(props as unknown as TracePageSearchBarProps)} />);
    const nextResButton = screen.getByRole('button', { name: 'Next result button' });
    const prevResButton = screen.getByRole('button', { name: 'Prev result button' });
    expect(nextResButton).toBeInTheDocument();
    expect(prevResButton).toBeInTheDocument();
    expect((nextResButton as HTMLButtonElement)['disabled']).toBe(false);
    expect((prevResButton as HTMLButtonElement)['disabled']).toBe(false);
  });
});
