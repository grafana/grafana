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

import { shallow } from 'enzyme';
// eslint-disable-next-line lodash/import-scope
import _ from 'lodash';
import * as React from 'react';

import { Input } from '@grafana/ui';

import UiFindInput from './UiFindInput';

const debounceMock = jest.spyOn(_, 'debounce').mockImplementation((func) => {
  return Object.assign(func, { cancel: jest.fn(), flush: jest.fn() });
});

describe('UiFindInput', () => {
  const flushMock = jest.fn();

  const uiFind = 'uiFind';
  const ownInputValue = 'ownInputValue';
  const props = {
    uiFind: undefined,
    history: {
      replace: () => {},
    },
    location: {
      search: null,
    },
  };
  let wrapper;

  beforeAll(() => {
    debounceMock.mockImplementation((fn) => {
      function debounceFunction(...args) {
        fn(...args);
      }
      debounceFunction.flush = flushMock;
      return debounceFunction;
    });
  });

  beforeEach(() => {
    flushMock.mockReset();
    wrapper = shallow(<UiFindInput {...props} />);
  });

  describe('rendering', () => {
    it('renders as expected', () => {
      expect(wrapper).toMatchSnapshot();
    });

    it('renders props.uiFind when state.ownInputValue is `undefined`', () => {
      wrapper.setProps({ value: uiFind });
      expect(wrapper.find(Input).prop('value')).toBe(uiFind);
    });
  });
});
