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

import AccordianKeyValues, { KeyValuesSummary } from './AccordianKeyValues';
import * as markers from './AccordianKeyValues.markers';
import KeyValuesTable from './KeyValuesTable';

const tags = [{ key: 'span.kind', value: 'client' }, { key: 'omg', value: 'mos-def' }];

describe('<KeyValuesSummary>', () => {
  let wrapper;

  const props = { data: tags };

  beforeEach(() => {
    wrapper = shallow(<KeyValuesSummary {...props} />);
  });

  it('renders without exploding', () => {
    expect(wrapper).toBeDefined();
  });

  it('returns `null` when props.data is empty', () => {
    wrapper.setProps({ data: null });
    expect(wrapper.isEmptyRender()).toBe(true);
  });

  it('generates a list from `data`', () => {
    expect(wrapper.find('li').length).toBe(tags.length);
  });

  it('renders the data as text', () => {
    const texts = wrapper.find('li').map(node => node.text());
    const expectedTexts = tags.map(tag => `${tag.key}=${tag.value}`);
    expect(texts).toEqual(expectedTexts);
  });
});

describe('<AccordianKeyValues>', () => {
  let wrapper;

  const props = {
    compact: false,
    data: tags,
    highContrast: false,
    isOpen: false,
    label: 'le-label',
    onToggle: jest.fn(),
  };

  beforeEach(() => {
    wrapper = shallow(<AccordianKeyValues {...props} />);
  });

  it('renders without exploding', () => {
    expect(wrapper).toBeDefined();
    expect(wrapper.exists()).toBe(true);
  });

  it('renders the label', () => {
    const header = wrapper.find(`[data-test="${markers.LABEL}"]`);
    expect(header.length).toBe(1);
    expect(header.text()).toBe(`${props.label}:`);
  });

  it('renders the summary instead of the table when it is not expanded', () => {
    const summary = wrapper.find('[data-test-id="AccordianKeyValues--header"]').find(KeyValuesSummary);
    expect(summary.length).toBe(1);
    expect(summary.prop('data')).toBe(tags);
    expect(wrapper.find(KeyValuesTable).length).toBe(0);
  });

  it('renders the table instead of the summarywhen it is expanded', () => {
    wrapper.setProps({ isOpen: true });
    expect(wrapper.find(KeyValuesSummary).length).toBe(0);
    const table = wrapper.find(KeyValuesTable);
    expect(table.length).toBe(1);
    expect(table.prop('data')).toBe(tags);
  });
});
