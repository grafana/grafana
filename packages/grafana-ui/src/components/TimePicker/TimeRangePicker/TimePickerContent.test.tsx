import { render, screen } from '@testing-library/react';
import React from 'react';
import { shallow } from 'enzyme';
import { TimePickerContentWithScreenSize } from './TimePickerContent';
import { dateTime, TimeRange } from '@grafana/data';

describe('TimePickerContent', () => {
  it('renders correctly in full screen', () => {
    const value = createAbsoluteTimeRange('2019-12-17T07:48:27.433Z', '2019-12-18T07:48:27.433Z');
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
    const value = createAbsoluteTimeRange('2019-12-17T07:48:27.433Z', '2019-12-18T07:48:27.433Z');
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
    const value = createAbsoluteTimeRange('2019-12-17T07:48:27.433Z', '2019-12-18T07:48:27.433Z');
    const history = [
      createAbsoluteTimeRange('2019-12-17T07:48:27.433Z', '2019-12-18T07:48:27.433Z'),
      createAbsoluteTimeRange('2019-10-17T07:48:27.433Z', '2019-10-18T07:48:27.433Z'),
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

  it('renders with ranges', () => {
    const value = createAbsoluteTimeRange('2019-12-17T07:48:27.433Z', '2019-12-18T07:48:27.433Z');

    render(
      <TimePickerContentWithScreenSize
        onChangeTimeZone={() => {}}
        onChange={value => {}}
        timeZone="utc"
        value={value}
        isFullscreen={true}
      />
    );

    expect(screen.queryByText('Relative time ranges')).toBeInTheDocument();
    expect(screen.queryByText('Other quick ranges')).toBeInTheDocument();
  });

  it('renders without ranges', () => {
    const value = createAbsoluteTimeRange('2019-12-17T07:48:27.433Z', '2019-12-18T07:48:27.433Z');

    render(
      <TimePickerContentWithScreenSize
        onChangeTimeZone={() => {}}
        onChange={value => {}}
        timeZone="utc"
        value={value}
        isFullscreen={true}
        hideQuickRanges={true}
      />
    );

    expect(screen.queryByText('Relative time ranges')).not.toBeInTheDocument();
    expect(screen.queryByText('Other quick ranges')).not.toBeInTheDocument();
  });

  it('hides absolute picker when narrow screen, relative time and quick ranges', async () => {
    const value = createRelativeTimeRange();

    render(
      <TimePickerContentWithScreenSize
        onChangeTimeZone={() => {}}
        onChange={value => {}}
        timeZone="utc"
        value={value}
        isFullscreen={false}
      />
    );

    expect(screen.queryByLabelText('TimePicker from field')).not.toBeInTheDocument();
  });

  it('opens absolute picker when narrow screen, relative time and no quick ranges', () => {
    const value = createRelativeTimeRange();

    render(
      <TimePickerContentWithScreenSize
        onChangeTimeZone={() => {}}
        onChange={value => {}}
        timeZone="utc"
        value={value}
        isFullscreen={false}
        hideQuickRanges={true}
      />
    );

    expect(screen.queryByLabelText('TimePicker from field')).toBeInTheDocument();
  });

  it('opens absolute picker when narrow screen, absolute time and no quick ranges', () => {
    const value = createAbsoluteTimeRange('2019-12-17T07:48:27.433Z', '2019-12-18T07:48:27.433Z');

    render(
      <TimePickerContentWithScreenSize
        onChangeTimeZone={() => {}}
        onChange={value => {}}
        timeZone="utc"
        value={value}
        isFullscreen={false}
      />
    );

    expect(screen.queryByLabelText('TimePicker from field')).toBeInTheDocument();
  });

  it('opens absolute picker when narrow screen, absolute time and no quick ranges', () => {
    const value = createAbsoluteTimeRange('2019-12-17T07:48:27.433Z', '2019-12-18T07:48:27.433Z');

    render(
      <TimePickerContentWithScreenSize
        onChangeTimeZone={() => {}}
        onChange={value => {}}
        timeZone="utc"
        value={value}
        isFullscreen={false}
        hideQuickRanges={true}
      />
    );

    expect(screen.queryByLabelText('TimePicker from field')).toBeInTheDocument();
  });
});

function createRelativeTimeRange(): TimeRange {
  const now = dateTime();
  const now5m = now.subtract(5, 'm');

  return {
    from: now5m,
    to: now,
    raw: { from: 'now-5m', to: 'now' },
  };
}

function createAbsoluteTimeRange(from: string, to: string): TimeRange {
  return {
    from: dateTime(from),
    to: dateTime(to),
    raw: { from: dateTime(from), to: dateTime(to) },
  };
}
