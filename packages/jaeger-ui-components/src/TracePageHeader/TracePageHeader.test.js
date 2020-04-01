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
import { shallow, mount } from 'enzyme';

import SpanGraph from './SpanGraph';
import TracePageHeader, { HEADER_ITEMS } from './TracePageHeader';
import LabeledList from '../common/LabeledList';
import traceGenerator from '../demo/trace-generators';
import { getTraceName } from '../model/trace-viewer';
import transformTraceData from '../model/transform-trace-data';

describe('<TracePageHeader>', () => {
  const trace = transformTraceData(traceGenerator.trace({}));
  const defaultProps = {
    trace,
    showArchiveButton: false,
    showShortcutsHelp: false,
    showStandaloneLink: false,
    showViewOptions: false,
    textFilter: '',
    updateTextFilter: () => {},
  };

  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<TracePageHeader {...defaultProps} />);
  });

  it('renders a <header />', () => {
    expect(wrapper.find('header').length).toBe(1);
  });

  it('renders an empty <div> if a trace is not present', () => {
    wrapper = mount(<TracePageHeader {...defaultProps} trace={null} />);
    expect(wrapper.children().length).toBe(0);
  });

  it('renders the trace title', () => {
    expect(wrapper.find({ traceName: getTraceName(trace.spans) })).toBeTruthy();
  });

  it('renders the header items', () => {
    wrapper.find('.horizontal .item').forEach((item, i) => {
      expect(item.contains(HEADER_ITEMS[i].title)).toBeTruthy();
      expect(item.contains(HEADER_ITEMS[i].renderer(defaultProps.trace))).toBeTruthy();
    });
  });

  it('renders a <SpanGraph>', () => {
    expect(wrapper.find(SpanGraph).length).toBe(1);
  });

  describe('observes the visibility toggles for various UX elements', () => {
    it('hides the minimap when hideMap === true', () => {
      expect(wrapper.find(SpanGraph).length).toBe(1);
      wrapper.setProps({ hideMap: true });
      expect(wrapper.find(SpanGraph).length).toBe(0);
    });

    it('hides the summary when hideSummary === true', () => {
      expect(wrapper.find(LabeledList).length).toBe(1);
      wrapper.setProps({ hideSummary: true });
      expect(wrapper.find(LabeledList).length).toBe(0);
    });
  });
});
