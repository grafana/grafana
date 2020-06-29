import React from 'react';
import { shallow } from 'enzyme';
import { TimePickerContentWithScreenSize } from './TimePickerContent';
import { dateTime, TimeRange } from '@grafana/data';

describe('TimePickerContent', () => {
  it('renders correctly in full screen', () => {
    const value = createTimeRange('2019-12-17T07:48:27.433Z', '2019-12-18T07:48:27.433Z');
    const wrapper = shallow(
      <TimePickerContentWithScreenSize
        onChangeTimeZone={() => {}}
        onChange={value => {}}
        timeZone="utc"
        value={value}
        isFullscreen={true}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('renders correctly in narrow screen', () => {
    const value = createTimeRange('2019-12-17T07:48:27.433Z', '2019-12-18T07:48:27.433Z');
    const wrapper = shallow(
      <TimePickerContentWithScreenSize
        onChangeTimeZone={() => {}}
        onChange={value => {}}
        timeZone="utc"
        value={value}
        isFullscreen={false}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('renders recent absolute ranges correctly', () => {
    const value = createTimeRange('2019-12-17T07:48:27.433Z', '2019-12-18T07:48:27.433Z');
    const history = [
      createTimeRange('2019-12-17T07:48:27.433Z', '2019-12-18T07:48:27.433Z'),
      createTimeRange('2019-10-17T07:48:27.433Z', '2019-10-18T07:48:27.433Z'),
    ];

    const wrapper = shallow(
      <TimePickerContentWithScreenSize
        onChangeTimeZone={() => {}}
        onChange={value => {}}
        timeZone="utc"
        value={value}
        isFullscreen={true}
        history={history}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });
});

function createTimeRange(from: string, to: string): TimeRange {
  return {
    from: dateTime(from),
    to: dateTime(to),
    raw: { from: dateTime(from), to: dateTime(to) },
  };
}
