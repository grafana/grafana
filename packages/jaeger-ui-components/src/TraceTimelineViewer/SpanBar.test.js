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
import { mount } from 'enzyme';
import UIElementsContext, { UIPopover } from '../uiElementsContext';

import SpanBar from './SpanBar';

describe('<SpanBar>', () => {
  const shortLabel = 'omg-so-awesome';
  const longLabel = 'omg-awesome-long-label';

  const props = {
    longLabel,
    shortLabel,
    color: '#fff',
    hintSide: 'right',
    viewEnd: 1,
    viewStart: 0,
    getViewedBounds: s => {
      // Log entries
      if (s === 10) {
        return { start: 0.1, end: 0.1 };
      }
      if (s === 20) {
        return { start: 0.2, end: 0.2 };
      }
      return { error: 'error' };
    },
    rpc: {
      viewStart: 0.25,
      viewEnd: 0.75,
      color: '#000',
    },
    tracestartTime: 0,
    span: {
      logs: [
        {
          timestamp: 10,
          fields: [{ key: 'message', value: 'oh the log message' }, { key: 'something', value: 'else' }],
        },
        {
          timestamp: 10,
          fields: [
            { key: 'message', value: 'oh the second log message' },
            { key: 'something', value: 'different' },
          ],
        },
        {
          timestamp: 20,
          fields: [{ key: 'message', value: 'oh the next log message' }, { key: 'more', value: 'stuff' }],
        },
      ],
    },
  };

  it('renders without exploding', () => {
    const wrapper = mount(
      <UIElementsContext.Provider value={{ Popover: () => '' }}>
        <SpanBar {...props} />
      </UIElementsContext.Provider>
    );
    expect(wrapper).toBeDefined();
    const { onMouseOver, onMouseOut } = wrapper.find('[data-test-id="SpanBar--wrapper"]').props();
    const labelElm = wrapper.find('[data-test-id="SpanBar--label"]');
    expect(labelElm.text()).toBe(shortLabel);
    onMouseOver();
    expect(labelElm.text()).toBe(longLabel);
    onMouseOut();
    expect(labelElm.text()).toBe(shortLabel);
  });

  it('log markers count', () => {
    // 3 log entries, two grouped together with the same timestamp
    const wrapper = mount(
      <UIElementsContext.Provider value={{ Popover: () => '' }}>
        <SpanBar {...props} />
      </UIElementsContext.Provider>
    );
    expect(wrapper.find(UIPopover).length).toEqual(2);
  });
});
