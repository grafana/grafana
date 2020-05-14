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

import TraceTimelineViewer from './index';
import traceGenerator from '../demo/trace-generators';
import transformTraceData from '../model/transform-trace-data';
import TimelineHeaderRow from './TimelineHeaderRow';
import { defaultTheme } from '../Theme';

describe('<TraceTimelineViewer>', () => {
  const trace = transformTraceData(traceGenerator.trace({}));
  const props = {
    trace,
    textFilter: null,
    viewRange: {
      time: {
        current: [0, 1],
      },
    },
    traceTimeline: {
      spanNameColumnWidth: 0.5,
    },
    expandAll: jest.fn(),
    collapseAll: jest.fn(),
    expandOne: jest.fn(),
    collapseOne: jest.fn(),
    theme: defaultTheme,
    history: {
      replace: () => {},
    },
    location: {
      search: null,
    },
  };
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<TraceTimelineViewer {...props} />).dive().dive().dive();
  });

  it('it does not explode', () => {
    expect(wrapper).toBeDefined();
  });

  it('it sets up actions', () => {
    const headerRow = wrapper.find(TimelineHeaderRow);
    headerRow.props().onCollapseAll();
    headerRow.props().onExpandAll();
    headerRow.props().onExpandOne();
    headerRow.props().onCollapseOne();
    expect(props.collapseAll.mock.calls.length).toBe(1);
    expect(props.expandAll.mock.calls.length).toBe(1);
    expect(props.expandOne.mock.calls.length).toBe(1);
    expect(props.collapseOne.mock.calls.length).toBe(1);
  });
});
