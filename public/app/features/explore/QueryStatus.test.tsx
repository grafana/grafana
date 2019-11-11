import React from 'react';
import { shallow } from 'enzyme';

import { LoadingState, TimeRange, PanelData } from '@grafana/data';

import QueryStatus from './QueryStatus';

describe('<QueryStatus />', () => {
  it('should render with a latency', () => {
    const res: PanelData = { series: [], state: LoadingState.Done, timeRange: {} as TimeRange };
    const wrapper = shallow(<QueryStatus latency={0} queryResponse={res} />);
    expect(wrapper.find('div').exists()).toBeTruthy();
  });
  it('should not render when query has not started', () => {
    const res: PanelData = { series: [], state: LoadingState.NotStarted, timeRange: {} as TimeRange };
    const wrapper = shallow(<QueryStatus latency={0} queryResponse={res} />);
    expect(wrapper.getElement()).toBe(null);
  });
});
