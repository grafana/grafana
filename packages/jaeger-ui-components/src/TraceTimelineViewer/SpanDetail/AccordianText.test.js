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

import React from 'react';
import { shallow } from 'enzyme';
import AccordianText from './AccordianText';
import TextList from './TextList';

const warnings = ['Duplicated tag', 'Duplicated spanId'];

describe('<AccordianText>', () => {
  let wrapper;

  const props = {
    compact: false,
    data: warnings,
    highContrast: false,
    isOpen: false,
    label: 'le-label',
    onToggle: jest.fn(),
  };

  beforeEach(() => {
    wrapper = shallow(<AccordianText {...props} />);
  });

  it('renders without exploding', () => {
    expect(wrapper).toBeDefined();
    expect(wrapper.exists()).toBe(true);
  });

  it('renders the label', () => {
    const header = wrapper.find(`[data-test-id="AccordianText--header"] > strong`);
    expect(header.length).toBe(1);
    expect(header.text()).toBe(props.label);
  });

  it('renders the content when it is expanded', () => {
    wrapper.setProps({ isOpen: true });
    const content = wrapper.find(TextList);
    expect(content.length).toBe(1);
    expect(content.prop('data')).toBe(warnings);
  });
});
