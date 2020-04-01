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

import React from 'react';
import { shallow } from 'enzyme';

import * as markers from './TracePageSearchBar.markers';
import TracePageSearchBar, { getStyles } from './TracePageSearchBar';
import UiFindInput from '../common/UiFindInput';

const defaultProps = {
  forwardedRef: React.createRef(),
  navigable: true,
  nextResult: () => {},
  prevResult: () => {},
  resultCount: 0,
  textFilter: 'something',
};

describe('<TracePageSearchBar>', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<TracePageSearchBar {...defaultProps} />);
  });

  describe('truthy textFilter', () => {
    it('renders UiFindInput with correct props', () => {
      const renderedUiFindInput = wrapper.find(UiFindInput);
      const suffix = shallow(renderedUiFindInput.prop('inputProps').suffix);
      expect(renderedUiFindInput.prop('inputProps')).toEqual(
        expect.objectContaining({
          'data-test': markers.IN_TRACE_SEARCH,
          name: 'search',
        })
      );
      expect(suffix.hasClass(getStyles().TracePageSearchBarCount)).toBe(true);
      expect(suffix.text()).toBe(String(defaultProps.resultCount));
    });

    it('renders buttons', () => {
      const buttons = wrapper.find('UIButton');
      expect(buttons.length).toBe(4);
      buttons.forEach(button => {
        expect(button.hasClass(getStyles().TracePageSearchBarBtn)).toBe(true);
        expect(button.hasClass(getStyles().TracePageSearchBarBtnDisabled)).toBe(false);
        expect(button.prop('disabled')).toBe(false);
      });
      expect(wrapper.find('UIButton[icon="up"]').prop('onClick')).toBe(defaultProps.prevResult);
      expect(wrapper.find('UIButton[icon="down"]').prop('onClick')).toBe(defaultProps.nextResult);
      expect(wrapper.find('UIButton[icon="close"]').prop('onClick')).toBe(defaultProps.clearSearch);
    });

    it('hides navigation buttons when not navigable', () => {
      wrapper.setProps({ navigable: false });
      const button = wrapper.find('UIButton');
      expect(button.length).toBe(1);
      expect(button.prop('icon')).toBe('close');
    });
  });

  describe('falsy textFilter', () => {
    beforeEach(() => {
      wrapper.setProps({ textFilter: '' });
    });

    it('renders UiFindInput with correct props', () => {
      expect(wrapper.find(UiFindInput).prop('inputProps').suffix).toBe(null);
    });

    it('renders buttons', () => {
      const buttons = wrapper.find('UIButton');
      expect(buttons.length).toBe(4);
      buttons.forEach(button => {
        expect(button.hasClass(getStyles().TracePageSearchBarBtn)).toBe(true);
        expect(button.hasClass(getStyles().TracePageSearchBarBtnDisabled)).toBe(true);
        expect(button.prop('disabled')).toBe(true);
      });
    });
  });
});
