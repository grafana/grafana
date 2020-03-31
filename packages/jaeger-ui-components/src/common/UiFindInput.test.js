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

import * as React from 'react';
import { shallow } from 'enzyme';
import debounceMock from 'lodash/debounce';

import UiFindInput from './UiFindInput';

jest.mock('lodash/debounce');

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
    debounceMock.mockImplementation(fn => {
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
      wrapper.setProps({ uiFind });
      expect(wrapper.find(Input).prop('value')).toBe(uiFind);
    });

    it('renders state.ownInputValue when it is not `undefined` regardless of props.uiFind', () => {
      wrapper.setProps({ uiFind });
      wrapper.setState({ ownInputValue });
      expect(wrapper.find(Input).prop('value')).toBe(ownInputValue);
    });

    it('renders state.ownInputValue when it is an empty string props.uiFind is populated', () => {
      wrapper.setProps({ uiFind });
      wrapper.setState({ ownInputValue: '' });
      expect(wrapper.find(Input).prop('value')).toBe('');
    });
  });

  // describe('typing in input', () => {
  //   const newValue = 'newValue';

    // it('updates state', () => {
    //   wrapper.find(Input).simulate('change', { target: { value: newValue } });
    //   expect(wrapper.state('ownInputValue')).toBe(newValue);
    // });

    // it('calls updateUiFind with correct kwargs', () => {
    //   wrapper.find(Input).simulate('change', { target: { value: newValue } });
    //   expect(updateUiFindSpy).toHaveBeenLastCalledWith({
    //     history: props.history,
    //     location: props.location,
    //     trackFindFunction: undefined,
    //     uiFind: newValue,
    //   });
    // });

    // it('calls updateUiFind with correct kwargs with tracking enabled', () => {
    //   const trackFindFunction = function trackFindFunction() {};
    //   wrapper.setProps({ trackFindFunction });
    //   wrapper.find(Input).simulate('change', { target: { value: newValue } });
    //   expect(updateUiFindSpy).toHaveBeenLastCalledWith({
    //     history: props.history,
    //     location: props.location,
    //     trackFindFunction,
    //     uiFind: newValue,
    //   });
    // });

    // it('no-ops if value is unchanged', () => {
    //   wrapper.find(Input).simulate('change', { target: { value: '' } });
    //   expect(updateUiFindSpy).not.toHaveBeenCalled();
    //
    //   wrapper.setProps({ uiFind });
    //   wrapper.find(Input).simulate('change', { target: { value: uiFind } });
    //   expect(updateUiFindSpy).not.toHaveBeenCalled();
    // });
  // });

  // describe('blurring input', () => {
  //   it('clears state.ownInputValue', () => {
  //     wrapper.setState({ ownInputValue });
  //     expect(wrapper.state('ownInputValue')).toBe(ownInputValue);
  //     wrapper.find(Input).simulate('blur');
  //     expect(wrapper.state('ownInputValue')).toBe(undefined);
  //   });
  //
  //   it('triggers pending queryParameter updates', () => {
  //     wrapper.find(Input).simulate('blur');
  //     expect(flushMock).toHaveBeenCalledTimes(1);
  //   });
  // });

  // describe('clear uiFind', () => {
  //   const findIcon = () => shallow(<div>{wrapper.find(Input).prop('suffix')}</div>);
  //
  //   beforeEach(() => {
  //     wrapper.setProps({ allowClear: true });
  //   });
  //
  //   it('renders clear icon iff clear is enabled and value is a string with at least one character', () => {
  //     expect(findIcon().find(Icon)).toHaveLength(0);
  //
  //     wrapper.setProps({ uiFind: '' });
  //     expect(findIcon().find(Icon)).toHaveLength(0);
  //
  //     wrapper.setProps({ uiFind });
  //     expect(findIcon().find(Icon)).toHaveLength(1);
  //
  //     wrapper.setProps({ allowClear: false });
  //     expect(findIcon().find(Icon)).toHaveLength(0);
  //
  //     wrapper.setProps({ allowClear: true });
  //     wrapper.setState({ ownInputValue: '' });
  //     expect(findIcon().find(Icon)).toHaveLength(0);
  //   });
  //
  //   it('clears value immediately when clicked', () => {
  //     wrapper.setProps({ uiFind });
  //     findIcon()
  //       .find(Icon)
  //       .simulate('click');
  //
  //     expect(updateUiFindSpy).toHaveBeenLastCalledWith({
  //       history: props.history,
  //       location: props.location,
  //       uiFind: undefined,
  //     });
  //     expect(flushMock).toHaveBeenCalledTimes(1);
  //   });
  // });
  //
  // describe('extractUiFindFromState', () => {
  //   const reduxStateValue = 'state.router.location.search';
  //
  //   beforeEach(() => {
  //     queryStringParseSpy.mockReturnValue({ uiFind });
  //   });
  //
  //   it('returns uiFind from parsed state.router.location.search', () => {
  //     const result = extractUiFindFromState({
  //       router: {
  //         location: {
  //           search: reduxStateValue,
  //         },
  //       },
  //     });
  //     expect(queryStringParseSpy).toHaveBeenCalledWith(reduxStateValue);
  //     expect(result).toEqual({
  //       uiFind,
  //     });
  //   });
  //
  //   it('handles multiple uiFinds from parsed state.router.location.search', () => {
  //     queryStringParseSpy.mockReturnValue({ uiFind: [uiFind, reduxStateValue] });
  //     const result = extractUiFindFromState({
  //       router: {
  //         location: {
  //           search: reduxStateValue,
  //         },
  //       },
  //     });
  //     expect(queryStringParseSpy).toHaveBeenCalledWith(reduxStateValue);
  //     expect(result).toEqual({
  //       uiFind: `${uiFind} ${reduxStateValue}`,
  //     });
  //   });
  // });
});
