import React from 'react';
import { shallow } from 'enzyme';
import sinon from 'sinon';

import * as dateMath from '@grafana/ui/src/utils/datemath';
import * as rangeUtil from '@grafana/ui/src/utils/rangeutil';
import TimePicker from './TimePicker';
import { RawTimeRange, TimeRange, TIME_FORMAT } from '@grafana/ui';
import { toUtc, isDateTime, dateTime } from '@grafana/ui/src/utils/moment_wrapper';

const DEFAULT_RANGE = {
  from: 'now-6h',
  to: 'now',
};

const fromRaw = (rawRange: RawTimeRange): TimeRange => {
  const raw = {
    from: isDateTime(rawRange.from) ? dateTime(rawRange.from) : rawRange.from,
    to: isDateTime(rawRange.to) ? dateTime(rawRange.to) : rawRange.to,
  };

  return {
    from: dateMath.parse(raw.from, false),
    to: dateMath.parse(raw.to, true),
    raw: rawRange,
  };
};

describe('<TimePicker />', () => {
  it('render default values when closed and relative time range', () => {
    const range = fromRaw(DEFAULT_RANGE);
    const wrapper = shallow(<TimePicker range={range} />);
    expect(wrapper.state('fromRaw')).toBe(DEFAULT_RANGE.from);
    expect(wrapper.state('toRaw')).toBe(DEFAULT_RANGE.to);
    expect(wrapper.find('.timepicker-rangestring').text()).toBe('Last 6 hours');
    expect(wrapper.find('.gf-timepicker-dropdown').exists()).toBeFalsy();
    expect(wrapper.find('.gf-timepicker-utc').exists()).toBeFalsy();
  });

  it('render default values when closed, utc and relative time range', () => {
    const range = fromRaw(DEFAULT_RANGE);
    const wrapper = shallow(<TimePicker range={range} isUtc />);
    expect(wrapper.state('fromRaw')).toBe(DEFAULT_RANGE.from);
    expect(wrapper.state('toRaw')).toBe(DEFAULT_RANGE.to);
    expect(wrapper.find('.timepicker-rangestring').text()).toBe('Last 6 hours');
    expect(wrapper.find('.gf-timepicker-dropdown').exists()).toBeFalsy();
    expect(wrapper.find('.gf-timepicker-utc').exists()).toBeTruthy();
  });

  it('renders default values when open and relative range', () => {
    const range = fromRaw(DEFAULT_RANGE);
    const wrapper = shallow(<TimePicker range={range} isOpen />);
    expect(wrapper.state('fromRaw')).toBe(DEFAULT_RANGE.from);
    expect(wrapper.state('toRaw')).toBe(DEFAULT_RANGE.to);
    expect(wrapper.find('.timepicker-rangestring').text()).toBe('Last 6 hours');
    expect(wrapper.find('.gf-timepicker-dropdown').exists()).toBeTruthy();
    expect(wrapper.find('.gf-timepicker-utc').exists()).toBeFalsy();
    expect(wrapper.find('.timepicker-from').props().value).toBe(DEFAULT_RANGE.from);
    expect(wrapper.find('.timepicker-to').props().value).toBe(DEFAULT_RANGE.to);
  });

  it('renders default values when open, utc and relative range', () => {
    const range = fromRaw(DEFAULT_RANGE);
    const wrapper = shallow(<TimePicker range={range} isOpen isUtc />);
    expect(wrapper.state('fromRaw')).toBe(DEFAULT_RANGE.from);
    expect(wrapper.state('toRaw')).toBe(DEFAULT_RANGE.to);
    expect(wrapper.find('.timepicker-rangestring').text()).toBe('Last 6 hours');
    expect(wrapper.find('.gf-timepicker-dropdown').exists()).toBeTruthy();
    expect(wrapper.find('.gf-timepicker-utc').exists()).toBeTruthy();
    expect(wrapper.find('.timepicker-from').props().value).toBe(DEFAULT_RANGE.from);
    expect(wrapper.find('.timepicker-to').props().value).toBe(DEFAULT_RANGE.to);
  });

  it('apply with absolute range and non-utc', () => {
    const range = {
      from: toUtc(1),
      to: toUtc(1000),
      raw: {
        from: toUtc(1),
        to: toUtc(1000),
      },
    };
    const localRange = {
      from: dateTime(1),
      to: dateTime(1000),
      raw: {
        from: dateTime(1),
        to: dateTime(1000),
      },
    };
    const expectedRangeString = rangeUtil.describeTimeRange(localRange);

    const onChangeTime = sinon.spy();
    const wrapper = shallow(<TimePicker range={range} isOpen onChangeTime={onChangeTime} />);
    expect(wrapper.state('fromRaw')).toBe(localRange.from.format(TIME_FORMAT));
    expect(wrapper.state('toRaw')).toBe(localRange.to.format(TIME_FORMAT));
    expect(wrapper.state('initialRange')).toBe(range.raw);
    expect(wrapper.find('.timepicker-rangestring').text()).toBe(expectedRangeString);
    expect(wrapper.find('.timepicker-from').props().value).toBe(localRange.from.format(TIME_FORMAT));
    expect(wrapper.find('.timepicker-to').props().value).toBe(localRange.to.format(TIME_FORMAT));

    wrapper.find('button.gf-form-btn').simulate('click');
    expect(onChangeTime.calledOnce).toBeTruthy();
    expect(onChangeTime.getCall(0).args[0].from.valueOf()).toBe(0);
    expect(onChangeTime.getCall(0).args[0].to.valueOf()).toBe(1000);

    expect(wrapper.state('isOpen')).toBeFalsy();
    expect(wrapper.state('rangeString')).toBe(expectedRangeString);
  });

  it('apply with absolute range and utc', () => {
    const range = {
      from: toUtc(1),
      to: toUtc(1000),
      raw: {
        from: toUtc(1),
        to: toUtc(1000),
      },
    };
    const onChangeTime = sinon.spy();
    const wrapper = shallow(<TimePicker range={range} isUtc isOpen onChangeTime={onChangeTime} />);
    expect(wrapper.state('fromRaw')).toBe('1970-01-01 00:00:00');
    expect(wrapper.state('toRaw')).toBe('1970-01-01 00:00:01');
    expect(wrapper.state('initialRange')).toBe(range.raw);
    expect(wrapper.find('.timepicker-rangestring').text()).toBe('Jan 1, 1970 00:00:00 to Jan 1, 1970 00:00:01');
    expect(wrapper.find('.timepicker-from').props().value).toBe('1970-01-01 00:00:00');
    expect(wrapper.find('.timepicker-to').props().value).toBe('1970-01-01 00:00:01');

    wrapper.find('button.gf-form-btn').simulate('click');
    expect(onChangeTime.calledOnce).toBeTruthy();
    expect(onChangeTime.getCall(0).args[0].from.valueOf()).toBe(0);
    expect(onChangeTime.getCall(0).args[0].to.valueOf()).toBe(1000);

    expect(wrapper.state('isOpen')).toBeFalsy();
    expect(wrapper.state('rangeString')).toBe('Jan 1, 1970 00:00:00 to Jan 1, 1970 00:00:01');
  });

  it('moves ranges backward by half the range on left arrow click when utc', () => {
    const rawRange = {
      from: toUtc(2000),
      to: toUtc(4000),
      raw: {
        from: toUtc(2000),
        to: toUtc(4000),
      },
    };
    const range = fromRaw(rawRange);

    const onChangeTime = sinon.spy();
    const wrapper = shallow(<TimePicker range={range} isUtc isOpen onChangeTime={onChangeTime} />);
    expect(wrapper.state('fromRaw')).toBe('1970-01-01 00:00:02');
    expect(wrapper.state('toRaw')).toBe('1970-01-01 00:00:04');

    wrapper.find('.timepicker-left').simulate('click');
    expect(onChangeTime.calledOnce).toBeTruthy();
    expect(onChangeTime.getCall(0).args[0].from.valueOf()).toBe(1000);
    expect(onChangeTime.getCall(0).args[0].to.valueOf()).toBe(3000);
  });

  it('moves ranges backward by half the range on left arrow click when not utc', () => {
    const range = {
      from: toUtc(2000),
      to: toUtc(4000),
      raw: {
        from: toUtc(2000),
        to: toUtc(4000),
      },
    };
    const localRange = {
      from: dateTime(2000),
      to: dateTime(4000),
      raw: {
        from: dateTime(2000),
        to: dateTime(4000),
      },
    };

    const onChangeTime = sinon.spy();
    const wrapper = shallow(<TimePicker range={range} isUtc={false} isOpen onChangeTime={onChangeTime} />);
    expect(wrapper.state('fromRaw')).toBe(localRange.from.format(TIME_FORMAT));
    expect(wrapper.state('toRaw')).toBe(localRange.to.format(TIME_FORMAT));

    wrapper.find('.timepicker-left').simulate('click');
    expect(onChangeTime.calledOnce).toBeTruthy();
    expect(onChangeTime.getCall(0).args[0].from.valueOf()).toBe(1000);
    expect(onChangeTime.getCall(0).args[0].to.valueOf()).toBe(3000);
  });

  it('moves ranges forward by half the range on right arrow click when utc', () => {
    const range = {
      from: toUtc(1000),
      to: toUtc(3000),
      raw: {
        from: toUtc(1000),
        to: toUtc(3000),
      },
    };

    const onChangeTime = sinon.spy();
    const wrapper = shallow(<TimePicker range={range} isUtc isOpen onChangeTime={onChangeTime} />);
    expect(wrapper.state('fromRaw')).toBe('1970-01-01 00:00:01');
    expect(wrapper.state('toRaw')).toBe('1970-01-01 00:00:03');

    wrapper.find('.timepicker-right').simulate('click');
    expect(onChangeTime.calledOnce).toBeTruthy();
    expect(onChangeTime.getCall(0).args[0].from.valueOf()).toBe(2000);
    expect(onChangeTime.getCall(0).args[0].to.valueOf()).toBe(4000);
  });

  it('moves ranges forward by half the range on right arrow click when not utc', () => {
    const range = {
      from: toUtc(1000),
      to: toUtc(3000),
      raw: {
        from: toUtc(1000),
        to: toUtc(3000),
      },
    };
    const localRange = {
      from: dateTime(1000),
      to: dateTime(3000),
      raw: {
        from: dateTime(1000),
        to: dateTime(3000),
      },
    };

    const onChangeTime = sinon.spy();
    const wrapper = shallow(<TimePicker range={range} isOpen onChangeTime={onChangeTime} />);
    expect(wrapper.state('fromRaw')).toBe(localRange.from.format(TIME_FORMAT));
    expect(wrapper.state('toRaw')).toBe(localRange.to.format(TIME_FORMAT));

    wrapper.find('.timepicker-right').simulate('click');
    expect(onChangeTime.calledOnce).toBeTruthy();
    expect(onChangeTime.getCall(0).args[0].from.valueOf()).toBe(2000);
    expect(onChangeTime.getCall(0).args[0].to.valueOf()).toBe(4000);
  });
});
