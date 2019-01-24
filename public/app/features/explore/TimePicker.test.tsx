import React from 'react';
import { shallow } from 'enzyme';
import sinon from 'sinon';

import * as rangeUtil from 'app/core/utils/rangeutil';
import TimePicker, { DEFAULT_RANGE, parseTime } from './TimePicker';

describe('<TimePicker />', () => {
  it('renders closed with default values', () => {
    const rangeString = rangeUtil.describeTimeRange(DEFAULT_RANGE);
    const wrapper = shallow(<TimePicker />);
    expect(wrapper.find('.timepicker-rangestring').text()).toBe(rangeString);
    expect(wrapper.find('.gf-timepicker-dropdown').exists()).toBe(false);
  });

  it('renders with relative range', () => {
    const range = {
      from: 'now-7h',
      to: 'now',
    };
    const rangeString = rangeUtil.describeTimeRange(range);
    const wrapper = shallow(<TimePicker range={range} isOpen />);
    expect(wrapper.find('.timepicker-rangestring').text()).toBe(rangeString);
    expect(wrapper.state('fromRaw')).toBe(range.from);
    expect(wrapper.state('toRaw')).toBe(range.to);
    expect(wrapper.find('.timepicker-from').props().value).toBe(range.from);
    expect(wrapper.find('.timepicker-to').props().value).toBe(range.to);
  });

  it('renders with epoch (millies) range converted to ISO-ish', () => {
    const range = {
      from: '1',
      to: '1000',
    };
    const rangeString = rangeUtil.describeTimeRange({
      from: parseTime(range.from, true),
      to: parseTime(range.to, true),
    });
    const wrapper = shallow(<TimePicker range={range} isUtc isOpen />);
    expect(wrapper.state('fromRaw')).toBe('1970-01-01 00:00:00');
    expect(wrapper.state('toRaw')).toBe('1970-01-01 00:00:01');
    expect(wrapper.find('.timepicker-rangestring').text()).toBe(rangeString);
    expect(wrapper.find('.timepicker-from').props().value).toBe('1970-01-01 00:00:00');
    expect(wrapper.find('.timepicker-to').props().value).toBe('1970-01-01 00:00:01');
  });

  it('moves ranges forward and backward by half the range on arrow click', () => {
    const range = {
      from: '2000',
      to: '4000',
    };
    const rangeString = rangeUtil.describeTimeRange({
      from: parseTime(range.from, true),
      to: parseTime(range.to, true),
    });

    const onChangeTime = sinon.spy();
    const wrapper = shallow(<TimePicker range={range} isUtc isOpen onChangeTime={onChangeTime} />);
    expect(wrapper.state('fromRaw')).toBe('1970-01-01 00:00:02');
    expect(wrapper.state('toRaw')).toBe('1970-01-01 00:00:04');
    expect(wrapper.find('.timepicker-rangestring').text()).toBe(rangeString);
    expect(wrapper.find('.timepicker-from').props().value).toBe('1970-01-01 00:00:02');
    expect(wrapper.find('.timepicker-to').props().value).toBe('1970-01-01 00:00:04');

    wrapper.find('.timepicker-left').simulate('click');
    expect(onChangeTime.calledOnce).toBe(true);
    expect(wrapper.state('fromRaw')).toBe('1970-01-01 00:00:01');
    expect(wrapper.state('toRaw')).toBe('1970-01-01 00:00:03');

    wrapper.find('.timepicker-right').simulate('click');
    expect(wrapper.state('fromRaw')).toBe('1970-01-01 00:00:02');
    expect(wrapper.state('toRaw')).toBe('1970-01-01 00:00:04');
  });
});
