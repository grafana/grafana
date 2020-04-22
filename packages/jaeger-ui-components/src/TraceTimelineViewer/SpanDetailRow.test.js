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

import SpanDetailRow from './SpanDetailRow';
import SpanDetail from './SpanDetail';
import DetailState from './SpanDetail/DetailState';
import SpanTreeOffset from './SpanTreeOffset';

jest.mock('./SpanTreeOffset');

describe('<SpanDetailRow>', () => {
  const spanID = 'some-id';
  const props = {
    color: 'some-color',
    columnDivision: 0.5,
    detailState: new DetailState(),
    onDetailToggled: jest.fn(),
    linksGetter: jest.fn(),
    isFilteredOut: false,
    logItemToggle: jest.fn(),
    logsToggle: jest.fn(),
    processToggle: jest.fn(),
    span: { spanID, depth: 3 },
    tagsToggle: jest.fn(),
    traceStartTime: 1000,
  };

  let wrapper;

  beforeEach(() => {
    props.onDetailToggled.mockReset();
    props.linksGetter.mockReset();
    props.logItemToggle.mockReset();
    props.logsToggle.mockReset();
    props.processToggle.mockReset();
    props.tagsToggle.mockReset();
    wrapper = shallow(<SpanDetailRow {...props} />).dive().dive().dive();
  });

  it('renders without exploding', () => {
    expect(wrapper).toBeDefined();
  });

  it('escalates toggle detail', () => {
    const calls = props.onDetailToggled.mock.calls;
    expect(calls.length).toBe(0);
    wrapper.find('[data-test-id="detail-row-expanded-accent"]').prop('onClick')();
    expect(calls).toEqual([[spanID]]);
  });

  it('renders the span tree offset', () => {
    const spanTreeOffset = <SpanTreeOffset span={props.span} showChildrenIcon={false} />;
    expect(wrapper.contains(spanTreeOffset)).toBe(true);
  });

  it('renders the SpanDetail', () => {
    const spanDetail = (
      <SpanDetail
        detailState={props.detailState}
        linksGetter={wrapper.instance()._linksGetter}
        logItemToggle={props.logItemToggle}
        logsToggle={props.logsToggle}
        processToggle={props.processToggle}
        span={props.span}
        tagsToggle={props.tagsToggle}
        traceStartTime={props.traceStartTime}
      />
    );
    expect(wrapper.contains(spanDetail)).toBe(true);
  });

  it('adds span when calling linksGetter', () => {
    const spanDetail = wrapper.find(SpanDetail);
    const linksGetter = spanDetail.prop('linksGetter');
    const tags = [{ key: 'myKey', value: 'myValue' }];
    const linksGetterResponse = {};
    props.linksGetter.mockReturnValueOnce(linksGetterResponse);
    const result = linksGetter(tags, 0);
    expect(result).toBe(linksGetterResponse);
    expect(props.linksGetter).toHaveBeenCalledTimes(1);
    expect(props.linksGetter).toHaveBeenCalledWith(props.span, tags, 0);
  });
});
