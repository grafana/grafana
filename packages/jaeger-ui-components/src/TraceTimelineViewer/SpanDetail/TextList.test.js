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
import TextList from './TextList';

describe('<TextList>', () => {
  let wrapper;

  const data = [{ key: 'span.kind', value: 'client' }, { key: 'omg', value: 'mos-def' }];

  beforeEach(() => {
    wrapper = shallow(<TextList data={data} />);
  });

  it('renders without exploding', () => {
    expect(wrapper).toBeDefined();
    expect(wrapper.find('[data-test-id="TextList"]').length).toBe(1);
  });

  it('renders a table row for each data element', () => {
    const trs = wrapper.find('li');
    expect(trs.length).toBe(data.length);
  });
});
