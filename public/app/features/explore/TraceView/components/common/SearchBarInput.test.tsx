// Copyright (c) 2019 Uber Technologies, Inc.
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

import SearchBarInput from './SearchBarInput';

describe('SearchBarInput', () => {
  describe('rendering', () => {
    it('renders as expected with no value', () => {
      render(<SearchBarInput />);
      const searchBarInput = screen.queryByPlaceholderText('Find...');
      expect(searchBarInput).toBeInTheDocument();
      expect(searchBarInput?.getAttribute('value')).toEqual('');
    });

    it('renders as expected with value', () => {
      render(<SearchBarInput value="value" />);
      const searchBarInput = screen.queryByPlaceholderText('Find...');
      expect(searchBarInput).toBeInTheDocument();
      expect(searchBarInput?.getAttribute('value')).toEqual('value');
    });
  });
});
