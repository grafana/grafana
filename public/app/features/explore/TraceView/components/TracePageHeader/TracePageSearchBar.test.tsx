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

import { createTheme } from '@grafana/data';

import TracePageSearchBar, { getStyles, TracePageSearchBarProps } from './TracePageSearchBar';

const defaultProps = {
  forwardedRef: React.createRef(),
  navigable: true,
  searchValue: 'value',
};

describe('<TracePageSearchBar>', () => {
  describe('truthy textFilter', () => {
    it('renders UiFindInput with correct props', () => {
      render(<TracePageSearchBar {...(defaultProps as unknown as TracePageSearchBarProps)} />);
      expect((screen.getByPlaceholderText('Find...') as HTMLInputElement)['value']).toEqual('value');
      const suffix = screen.getByLabelText('Search bar suffix');
      const theme = createTheme();
      expect(suffix['className']).toBe(getStyles(theme).TracePageSearchBarSuffix);
      expect(suffix.textContent).toBe('suffix');
    });

    it('renders buttons', () => {
      render(<TracePageSearchBar {...(defaultProps as unknown as TracePageSearchBarProps)} />);
      const nextResButton = screen.queryByRole('button', { name: 'Next results button' });
      const prevResButton = screen.queryByRole('button', { name: 'Prev results button' });
      expect(nextResButton).toBeInTheDocument();
      expect(prevResButton).toBeInTheDocument();
      expect((nextResButton as HTMLButtonElement)['disabled']).toBe(false);
      expect((prevResButton as HTMLButtonElement)['disabled']).toBe(false);
    });

    it('only shows navigable buttons when navigable is true', () => {
      const props = {
        ...defaultProps,
        navigable: false,
      };
      render(<TracePageSearchBar {...(props as unknown as TracePageSearchBarProps)} />);
      expect(screen.queryByRole('button', { name: 'Next results button' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Prev results button' })).not.toBeInTheDocument();
    });
  });

  describe('falsy textFilter', () => {
    beforeEach(() => {
      const props = {
        ...defaultProps,
        searchValue: '',
      };
      render(<TracePageSearchBar {...(props as unknown as TracePageSearchBarProps)} />);
    });

    it('does not render suffix', () => {
      expect(screen.queryByLabelText('Search bar suffix')).not.toBeInTheDocument();
    });

    it('renders buttons', () => {
      expect(screen.getByRole('button', { name: 'Next results button' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Prev results button' })).toBeInTheDocument();
    });
  });
});
