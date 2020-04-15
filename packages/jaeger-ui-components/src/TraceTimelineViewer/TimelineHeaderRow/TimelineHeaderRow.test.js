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

import TimelineHeaderRow from './TimelineHeaderRow';
import TimelineColumnResizer from './TimelineColumnResizer';
import TimelineViewingLayer from './TimelineViewingLayer';
import Ticks from '../Ticks';
import TimelineCollapser from './TimelineCollapser';

describe('<TimelineHeaderRow>', () => {
  let wrapper;

  const nameColumnWidth = 0.25;
  const props = {
    nameColumnWidth,
    duration: 1234,
    numTicks: 5,
    onCollapseAll: () => {},
    onCollapseOne: () => {},
    onColummWidthChange: () => {},
    onExpandAll: () => {},
    onExpandOne: () => {},
    updateNextViewRangeTime: () => {},
    updateViewRangeTime: () => {},
    viewRangeTime: {
      current: [0.1, 0.9],
    },
  };

  beforeEach(() => {
    wrapper = shallow(<TimelineHeaderRow {...props} />);
  });

  it('renders without exploding', () => {
    expect(wrapper).toBeDefined();
    expect(wrapper.find('[data-test-id="TimelineHeaderRow"]').length).toBe(1);
  });

  it('propagates the name column width', () => {
    const nameCol = wrapper.find({ width: nameColumnWidth });
    const timelineCol = wrapper.find({ width: 1 - nameColumnWidth });
    expect(nameCol.length).toBe(1);
    expect(timelineCol.length).toBe(1);
  });

  it('renders the title', () => {
    expect(wrapper.find('h4').text()).toMatch(/Service.*?Operation/);
  });

  it('renders the TimelineViewingLayer', () => {
    const elm = (
      <TimelineViewingLayer
        boundsInvalidator={nameColumnWidth}
        updateNextViewRangeTime={props.updateNextViewRangeTime}
        updateViewRangeTime={props.updateViewRangeTime}
        viewRangeTime={props.viewRangeTime}
      />
    );
    expect(wrapper.containsMatchingElement(elm)).toBe(true);
  });

  it('renders the Ticks', () => {
    const [viewStart, viewEnd] = props.viewRangeTime.current;
    const elm = (
      <Ticks
        numTicks={props.numTicks}
        startTime={viewStart * props.duration}
        endTime={viewEnd * props.duration}
        showLabels
      />
    );
    expect(wrapper.containsMatchingElement(elm)).toBe(true);
  });

  it('renders the TimelineColumnResizer', () => {
    const elm = (
      <TimelineColumnResizer position={nameColumnWidth} onChange={props.onColummWidthChange} min={0.2} max={0.85} />
    );
    expect(wrapper.containsMatchingElement(elm)).toBe(true);
  });

  it('renders the TimelineCollapser', () => {
    const elm = (
      <TimelineCollapser
        onCollapseAll={props.onCollapseAll}
        onExpandAll={props.onExpandAll}
        onCollapseOne={props.onCollapseOne}
        onExpandOne={props.onExpandOne}
      />
    );
    expect(wrapper.containsMatchingElement(elm)).toBe(true);
  });
});
