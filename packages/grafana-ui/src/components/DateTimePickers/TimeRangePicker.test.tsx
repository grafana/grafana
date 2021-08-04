import { createTheme, dateTime, TimeRange } from '@grafana/data';
import { render } from '@testing-library/react';
import React from 'react';
import { UnthemedTimeRangePicker } from './TimeRangePicker';

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
      <UnthemedTimeRangePicker
        onChangeTimeZone={() => {}}
        onChange={(value) => {}}
        value={value}
        onMoveBackward={() => {}}
        onMoveForward={() => {}}
        onZoom={() => {}}
        theme={createTheme().v1}
      />
    );

    expect(container.queryByLabelText(/Time range picker/i)).toBeInTheDocument();
  });
});
