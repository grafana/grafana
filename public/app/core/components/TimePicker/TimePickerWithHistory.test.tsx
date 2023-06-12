import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { getDefaultTimeRange, systemDateFormats } from '@grafana/data';

import { TimePickerWithHistory } from './TimePickerWithHistory';

describe('TimePickerWithHistory', () => {
  // In some of the tests we close and re-open the picker. When we do that we must re-find these inputs
  // as new elements will have been mounted
  const getFromField = () => screen.getByLabelText('Time Range from field');
  const getToField = () => screen.getByLabelText('Time Range to field');
  const getApplyButton = () => screen.getByRole('button', { name: 'Apply time range' });

  const LOCAL_STORAGE_KEY = 'grafana.dashboard.timepicker.history';
  const OLD_LOCAL_STORAGE = [
    {
      from: '2022-12-03T00:00:00.000Z',
      to: '2022-12-03T23:59:59.000Z',
      raw: { from: '2022-12-03T00:00:00.000Z', to: '2022-12-03T23:59:59.000Z' },
    },
    {
      from: '2022-12-02T00:00:00.000Z',
      to: '2022-12-02T23:59:59.000Z',
      raw: { from: '2022-12-02T00:00:00.000Z', to: '2022-12-02T23:59:59.000Z' },
    },
  ];

  const NEW_LOCAL_STORAGE = [
    { from: '2022-12-03T00:00:00.000Z', to: '2022-12-03T23:59:59.000Z' },
    { from: '2022-12-02T00:00:00.000Z', to: '2022-12-02T23:59:59.000Z' },
  ];

  const props = {
    timeZone: 'utc',
    onChange: () => {},
    onChangeTimeZone: () => {},
    onMoveBackward: () => {},
    onMoveForward: () => {},
    onZoom: () => {},
  };

  afterEach(() => {
    window.localStorage.clear();
  });

  it('Should load with no history', async () => {
    const timeRange = getDefaultTimeRange();
    render(<TimePickerWithHistory value={timeRange} {...props} />);
    await userEvent.click(screen.getByLabelText(/Time range selected/));

    expect(screen.getByText(/It looks like you haven't used this time picker before/i)).toBeInTheDocument();
  });

  it('Should load with old TimeRange history', async () => {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(OLD_LOCAL_STORAGE));

    const timeRange = getDefaultTimeRange();
    render(<TimePickerWithHistory value={timeRange} {...props} />);
    await userEvent.click(screen.getByLabelText(/Time range selected/));

    expect(screen.getByText(/2022-12-03 00:00:00 to 2022-12-03 23:59:59/i)).toBeInTheDocument();
    expect(screen.queryByText(/2022-12-02 00:00:00 to 2022-12-02 23:59:59/i)).toBeInTheDocument();
  });

  it('Should load with new TimePickerHistoryItem history', async () => {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(NEW_LOCAL_STORAGE));

    const timeRange = getDefaultTimeRange();
    render(<TimePickerWithHistory value={timeRange} {...props} />);
    await userEvent.click(screen.getByLabelText(/Time range selected/));

    expect(screen.queryByText(/2022-12-03 00:00:00 to 2022-12-03 23:59:59/i)).toBeInTheDocument();
    expect(screen.queryByText(/2022-12-02 00:00:00 to 2022-12-02 23:59:59/i)).toBeInTheDocument();
  });

  it('Saves changes into local storage without duplicates', async () => {
    const timeRange = getDefaultTimeRange();
    render(<TimePickerWithHistory value={timeRange} {...props} />);
    await userEvent.click(screen.getByLabelText(/Time range selected/));

    await clearAndType(getFromField(), '2022-12-03 00:00:00');
    await clearAndType(getToField(), '2022-12-03 23:59:59');
    await userEvent.click(getApplyButton());

    await userEvent.click(screen.getByLabelText(/Time range selected/));

    // Same range again!
    await clearAndType(getFromField(), '2022-12-03 00:00:00');
    await clearAndType(getToField(), '2022-12-03 23:59:59');
    await userEvent.click(getApplyButton());

    const newLsValue = JSON.parse(window.localStorage.getItem(LOCAL_STORAGE_KEY) ?? '[]');
    expect(newLsValue).toEqual([{ from: '2022-12-03T00:00:00.000Z', to: '2022-12-03T23:59:59.000Z' }]);
  });

  it('Should show 4 most recently used time ranges', async () => {
    const inputRanges: Array<[string, string]> = [
      ['2022-12-10 00:00:00', '2022-12-10 23:59:59'],
      ['2022-12-11 00:00:00', '2022-12-11 23:59:59'],
      ['2022-12-12 00:00:00', '2022-12-12 23:59:59'],
      ['2022-12-13 00:00:00', '2022-12-13 23:59:59'],
      ['2022-12-14 00:00:00', '2022-12-14 23:59:59'],
    ];

    const expectedLocalStorage = [
      { from: '2022-12-14T00:00:00.000Z', to: '2022-12-14T23:59:59.000Z' },
      { from: '2022-12-13T00:00:00.000Z', to: '2022-12-13T23:59:59.000Z' },
      { from: '2022-12-12T00:00:00.000Z', to: '2022-12-12T23:59:59.000Z' },
      { from: '2022-12-11T00:00:00.000Z', to: '2022-12-11T23:59:59.000Z' },
    ];

    const timeRange = getDefaultTimeRange();
    render(<TimePickerWithHistory value={timeRange} {...props} />);
    await userEvent.click(screen.getByLabelText(/Time range selected/));

    for (const [inputFrom, inputTo] of inputRanges) {
      await userEvent.click(screen.getByLabelText(/Time range selected/));
      await clearAndType(getFromField(), inputFrom);
      await clearAndType(getToField(), inputTo);

      await userEvent.click(getApplyButton());
    }

    const newLsValue = JSON.parse(window.localStorage.getItem(LOCAL_STORAGE_KEY) ?? '[]');
    expect(newLsValue).toEqual(expectedLocalStorage);
  });

  it('Should display handle timezones correctly', async () => {
    const timeRange = getDefaultTimeRange();
    render(<TimePickerWithHistory value={timeRange} {...props} {...{ timeZone: 'Eastern/Pacific' }} />);
    await userEvent.click(screen.getByLabelText(/Time range selected/));

    await clearAndType(getFromField(), '2022-12-10 00:00:00');
    await clearAndType(getToField(), '2022-12-10 23:59:59');
    await userEvent.click(getApplyButton());

    await userEvent.click(screen.getByLabelText(/Time range selected/));

    expect(screen.getByText(/2022-12-10 00:00:00 to 2022-12-10 23:59:59/i)).toBeInTheDocument();
  });

  it('Should display history correctly with custom time format', async () => {
    const timeRange = getDefaultTimeRange();

    const interval = {
      millisecond: 'HH:mm:ss.SSS',
      second: 'HH:mm:ss',
      minute: 'HH:mm',
      hour: 'DD-MM HH:mm',
      day: 'DD-MM',
      month: 'MM-YYYY',
      year: 'YYYY',
    };

    systemDateFormats.update({
      fullDate: 'DD-MM-YYYY HH:mm:ss',
      interval: interval,
      useBrowserLocale: false,
    });
    render(<TimePickerWithHistory value={timeRange} {...props} />);
    await userEvent.click(screen.getByLabelText(/Time range selected/));

    await clearAndType(getFromField(), '03-12-2022 00:00:00');
    await clearAndType(getToField(), '03-12-2022 23:59:59');
    await userEvent.click(getApplyButton());

    await userEvent.click(screen.getByLabelText(/Time range selected/));

    expect(screen.getByText(/03-12-2022 00:00:00 to 03-12-2022 23:59:59/i)).toBeInTheDocument();
  });
});

async function clearAndType(field: HTMLElement, text: string) {
  await userEvent.clear(field);
  return await userEvent.type(field, text);
}
