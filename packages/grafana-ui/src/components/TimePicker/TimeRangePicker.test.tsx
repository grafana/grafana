import React from 'react';
import { mount } from 'enzyme';
import { UnthemedTimeRangePicker } from './TimeRangePicker';
import { dateTime, TimeRange } from '@grafana/data';
import dark from '../../themes/dark';

const from = '2019-12-17T07:48:27.433Z';
const to = '2019-12-18T07:48:27.433Z';

const value: TimeRange = {
  from: dateTime(from),
  to: dateTime(to),
  raw: { from: dateTime(from), to: dateTime(to) },
};

describe('TimePicker', () => {
  it('renders buttons correctly', () => {
    const wrapper = mount(
      <UnthemedTimeRangePicker
        onChange={value => {}}
        value={value}
        onMoveBackward={() => {}}
        onMoveForward={() => {}}
        onZoom={() => {}}
        theme={dark}
      />
    );
    expect(wrapper.exists('.navbar-button')).toBe(true);
  });
});
