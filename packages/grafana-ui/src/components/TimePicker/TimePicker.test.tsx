import React from 'react';
import { shallow } from 'enzyme';
import { UnthemedTimePicker } from './TimePicker';
import { dateTime, TimeRange } from '@grafana/data';
import dark from './../../themes/dark';

const from = '2019-12-17T07:48:27.433Z';
const to = '2019-12-18T07:48:27.433Z';

const value: TimeRange = {
  from: dateTime(from),
  to: dateTime(to),
  raw: { from: dateTime(from), to: dateTime(to) },
};

describe('TimePicker', () => {
  it('renders buttons correctly', () => {
    const wrapper = shallow(
      <UnthemedTimePicker
        onChange={value => {}}
        value={value}
        onMoveBackward={() => {}}
        onMoveForward={() => {}}
        onZoom={() => {}}
        theme={dark}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('renders content correctly after beeing open', () => {
    const wrapper = shallow(
      <UnthemedTimePicker
        onChange={value => {}}
        value={value}
        onMoveBackward={() => {}}
        onMoveForward={() => {}}
        onZoom={() => {}}
        theme={dark}
      />
    );

    wrapper.find('button[aria-label="TimePicker Open Button"]').simulate('click', new Event('click'));
    expect(wrapper).toMatchSnapshot();
  });
});
