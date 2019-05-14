import React from 'react';
import { shallow } from 'enzyme';
import sinon from 'sinon';
import * as rangeUtil from 'app/core/utils/rangeutil';
import TimePicker, { DEFAULT_RANGE, parseTime } from './TimePicker';
describe('<TimePicker />', function () {
    it('renders closed with default values', function () {
        var rangeString = rangeUtil.describeTimeRange(DEFAULT_RANGE);
        var wrapper = shallow(React.createElement(TimePicker, null));
        expect(wrapper.find('.timepicker-rangestring').text()).toBe(rangeString);
        expect(wrapper.find('.gf-timepicker-dropdown').exists()).toBe(false);
    });
    it('renders with relative range', function () {
        var range = {
            from: 'now-7h',
            to: 'now',
        };
        var rangeString = rangeUtil.describeTimeRange(range);
        var wrapper = shallow(React.createElement(TimePicker, { range: range, isOpen: true }));
        expect(wrapper.find('.timepicker-rangestring').text()).toBe(rangeString);
        expect(wrapper.state('fromRaw')).toBe(range.from);
        expect(wrapper.state('toRaw')).toBe(range.to);
        expect(wrapper.find('.timepicker-from').props().value).toBe(range.from);
        expect(wrapper.find('.timepicker-to').props().value).toBe(range.to);
    });
    it('renders with epoch (millies) range converted to ISO-ish', function () {
        var range = {
            from: '1',
            to: '1000',
        };
        var rangeString = rangeUtil.describeTimeRange({
            from: parseTime(range.from, true),
            to: parseTime(range.to, true),
        });
        var wrapper = shallow(React.createElement(TimePicker, { range: range, isUtc: true, isOpen: true }));
        expect(wrapper.state('fromRaw')).toBe('1970-01-01 00:00:00');
        expect(wrapper.state('toRaw')).toBe('1970-01-01 00:00:01');
        expect(wrapper.find('.timepicker-rangestring').text()).toBe(rangeString);
        expect(wrapper.find('.timepicker-from').props().value).toBe('1970-01-01 00:00:00');
        expect(wrapper.find('.timepicker-to').props().value).toBe('1970-01-01 00:00:01');
    });
    it('moves ranges forward and backward by half the range on arrow click', function () {
        var range = {
            from: '2000',
            to: '4000',
        };
        var rangeString = rangeUtil.describeTimeRange({
            from: parseTime(range.from, true),
            to: parseTime(range.to, true),
        });
        var onChangeTime = sinon.spy();
        var wrapper = shallow(React.createElement(TimePicker, { range: range, isUtc: true, isOpen: true, onChangeTime: onChangeTime }));
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
//# sourceMappingURL=TimePicker.test.js.map