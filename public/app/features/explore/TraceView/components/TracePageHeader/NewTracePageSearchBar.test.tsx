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

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { defaultFilters } from '../../useSearch';

import NewTracePageSearchBar, { getStyles } from './NewTracePageSearchBar';

describe('<NewTracePageSearchBar>', () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeEach(() => {
    jest.useFakeTimers();
    // Need to use delay: null here to work with fakeTimers
    // see https://github.com/testing-library/user-event/issues/833
    user = userEvent.setup({ delay: null });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const NewTracePageSearchBarWithProps = (props: { matches: string[] | undefined }) => {
    const searchBarProps = {
      search: defaultFilters,
      spanFilterMatches: props.matches ? new Set(props.matches) : undefined,
      showSpanFilterMatchesOnly: false,
      setShowSpanFilterMatchesOnly: jest.fn(),
      setFocusedSpanIdForSearch: jest.fn(),
      datasourceType: '',
      clear: jest.fn(),
      totalSpans: 100,
    };

    return <NewTracePageSearchBar {...searchBarProps} />;
  };

  it('should render', () => {
    expect(() => render(<NewTracePageSearchBarWithProps matches={[]} />)).not.toThrow();
  });

  it('renders buttons', () => {
    render(<NewTracePageSearchBarWithProps matches={[]} />);
    const nextResButton = screen.queryByRole('button', { name: 'Next result button' });
    const prevResButton = screen.queryByRole('button', { name: 'Prev result button' });
    const clearFiltersButton = screen.getByRole('button', { name: 'Clear filters button' });
    expect(nextResButton).toBeInTheDocument();
    expect(prevResButton).toBeInTheDocument();
    expect(clearFiltersButton).toBeInTheDocument();
    expect((nextResButton as HTMLButtonElement)['disabled']).toBe(true);
    expect((prevResButton as HTMLButtonElement)['disabled']).toBe(true);
    expect((clearFiltersButton as HTMLButtonElement)['disabled']).toBe(true);
  });

  it('renders total spans', async () => {
    render(<NewTracePageSearchBarWithProps matches={undefined} />);
    expect(screen.getByText('100 spans')).toBeDefined();
  });

  it('renders buttons that can be used to search if filters added', () => {
    render(<NewTracePageSearchBarWithProps matches={['2ed38015486087ca']} />);
    const nextResButton = screen.queryByRole('button', { name: 'Next result button' });
    const prevResButton = screen.queryByRole('button', { name: 'Prev result button' });
    expect(nextResButton).toBeInTheDocument();
    expect(prevResButton).toBeInTheDocument();
    expect((nextResButton as HTMLButtonElement)['disabled']).toBe(false);
    expect((prevResButton as HTMLButtonElement)['disabled']).toBe(false);
    expect(screen.getByText('1 match')).toBeDefined();
  });

  it('renders correctly when moving through matches', async () => {
    render(<NewTracePageSearchBarWithProps matches={['1ed38015486087ca', '2ed38015486087ca', '3ed38015486087ca']} />);
    const nextResButton = screen.queryByRole('button', { name: 'Next result button' });
    const prevResButton = screen.queryByRole('button', { name: 'Prev result button' });
    expect(screen.getByText('3 matches')).toBeDefined();
    await user.click(nextResButton!);
    expect(screen.getByText('1/3 matches')).toBeDefined();
    await user.click(nextResButton!);
    expect(screen.getByText('2/3 matches')).toBeDefined();
    await user.click(nextResButton!);
    expect(screen.getByText('3/3 matches')).toBeDefined();
    await user.click(nextResButton!);
    expect(screen.getByText('1/3 matches')).toBeDefined();
    await user.click(prevResButton!);
    expect(screen.getByText('3/3 matches')).toBeDefined();
    await user.click(prevResButton!);
    expect(screen.getByText('2/3 matches')).toBeDefined();
  });

  it('renders correctly when there are no matches i.e. too many filters added', async () => {
    const { container } = render(<NewTracePageSearchBarWithProps matches={[]} />);
    const styles = getStyles();
    const tooltip = container.querySelector('.' + styles.matchesTooltip);
    expect(screen.getByText('0 matches')).toBeDefined();
    userEvent.hover(tooltip!);
    jest.advanceTimersByTime(1000);
    await waitFor(() => {
      expect(screen.getByText(/0 span matches for the filters selected/)).toBeDefined();
    });
  });

  it('renders show span filter matches only switch', async () => {
    render(<NewTracePageSearchBarWithProps matches={[]} />);
    const matchesSwitch = screen.getByRole('checkbox', { name: 'Show matches only switch' });
    expect(matchesSwitch).toBeInTheDocument();
  });
});
