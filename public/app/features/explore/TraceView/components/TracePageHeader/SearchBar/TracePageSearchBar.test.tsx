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

import { DEFAULT_SPAN_FILTERS } from 'app/features/explore/state/constants';

import { trace } from '../mocks';

import TracePageSearchBar from './TracePageSearchBar';

describe('<TracePageSearchBar>', () => {
  const TracePageSearchBarWithProps = (props: { matches: string[] | undefined }) => {
    const searchBarProps = {
      trace: trace,
      search: DEFAULT_SPAN_FILTERS,
      spanFilterMatches: props.matches ? new Set(props.matches) : undefined,
      setShowSpanFilterMatchesOnly: jest.fn(),
      setFocusedSpanIdForSearch: jest.fn(),
      focusedSpanIndexForSearch: -1,
      setFocusedSpanIndexForSearch: jest.fn(),
      datasourceType: '',
      showSpanFilters: true,
    };

    return <TracePageSearchBar {...searchBarProps} />;
  };

  it('should render', () => {
    expect(() => render(<TracePageSearchBarWithProps matches={[]} />)).not.toThrow();
  });

  it('renders show all spans switch', async () => {
    render(<TracePageSearchBarWithProps matches={['span1']} />);
    const matchesSwitch = await screen.findByRole('switch', { name: 'Show all spans' });
    expect(matchesSwitch).toBeInTheDocument();
  });
});
