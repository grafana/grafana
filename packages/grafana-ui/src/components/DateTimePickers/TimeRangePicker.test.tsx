import { render } from '@testing-library/react';
import React from 'react';

import { dateTime, TimeRange } from '@grafana/data';

import { TimeRangePicker } from './TimeRangePicker';

const from = dateTime('2019-12-17T07:48:27.433Z');
const to = dateTime('2019-12-18T07:48:27.433Z');

const value: TimeRange = {
  from,
  to,
  raw: { from, to },
};

describe('TimePicker', () => {
  it('renders buttons correctly', () => {
    const container = render(
      <TimeRangePicker
        onChangeTimeZone={() => {}}
        onChange={(value) => {}}
        value={value}
        onMoveBackward={() => {}}
        onMoveForward={() => {}}
        onZoom={() => {}}
      />
    );

    expect(container.queryByLabelText(/Time range selected/i)).toBeInTheDocument();
  });
});
