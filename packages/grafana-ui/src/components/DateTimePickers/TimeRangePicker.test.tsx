import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { dateTime, makeTimeRange, TimeRange } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';

import { TimeRangeProvider } from './TimeRangeContext';
import { TimePickerTooltip, TimeRangePicker } from './TimeRangePicker';

const selectors = e2eSelectors.components.TimePicker;

const from = dateTime('2019-12-17T07:48:27.433Z');
const to = dateTime('2019-12-18T07:48:27.433Z');

const value: TimeRange = {
  from,
  to,
  raw: { from, to },
};

const relativeValue: TimeRange = {
  from: from.subtract(1, 'hour'),
  to: to,
  raw: { from: 'now-1h', to: 'now' },
};

describe('TimePicker', () => {
  it('renders buttons correctly', () => {
    render(
      <TimeRangePicker
        onChangeTimeZone={() => {}}
        onChange={(value) => {}}
        value={value}
        onMoveBackward={() => {}}
        onMoveForward={() => {}}
        onZoom={() => {}}
      />
    );

    expect(screen.getByLabelText(/Time range selected/i)).toBeInTheDocument();
  });

  it('renders move buttons with relative range', () => {
    render(
      <TimeRangePicker
        onChangeTimeZone={() => {}}
        onChange={(value) => {}}
        value={relativeValue}
        onMoveBackward={() => {}}
        onMoveForward={() => {}}
        onZoom={() => {}}
      />
    );

    expect(screen.getByLabelText(/Move time range backwards/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Move time range forwards/i)).toBeInTheDocument();
  });

  it('renders move buttons with absolute range', () => {
    render(
      <TimeRangePicker
        onChangeTimeZone={() => {}}
        onChange={(value) => {}}
        value={value}
        onMoveBackward={() => {}}
        onMoveForward={() => {}}
        onZoom={() => {}}
      />
    );

    expect(screen.getByLabelText(/Move time range backwards/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Move time range forwards/i)).toBeInTheDocument();
  });

  it('switches overlay content visibility when toolbar button is clicked twice', async () => {
    render(
      <TimeRangePicker
        onChangeTimeZone={() => {}}
        onChange={(value) => {}}
        value={value}
        onMoveBackward={() => {}}
        onMoveForward={() => {}}
        onZoom={() => {}}
      />
    );

    const openButton = screen.getByTestId(selectors.openButton);
    const overlayContent = screen.queryByTestId(selectors.overlayContent);

    expect(overlayContent).not.toBeInTheDocument();
    await userEvent.click(openButton);
    expect(screen.getByTestId(selectors.overlayContent)).toBeInTheDocument();
    await userEvent.click(openButton);
    expect(overlayContent).not.toBeInTheDocument();
  });

  it('shows a sync button if two are rendered inside a TimeRangeProvider', async () => {
    const onChange1 = jest.fn();
    const onChange2 = jest.fn();
    const value1 = makeTimeRange('2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z');
    const value2 = makeTimeRange('2024-01-01T00:00:00Z', '2024-01-01T02:00:00Z');

    render(
      <TimeRangeProvider>
        <TimeRangePicker
          onChangeTimeZone={() => {}}
          onChange={onChange1}
          value={value1}
          onMoveBackward={() => {}}
          onMoveForward={() => {}}
          onZoom={() => {}}
        />
        <TimeRangePicker
          onChangeTimeZone={() => {}}
          onChange={onChange2}
          value={value2}
          onMoveBackward={() => {}}
          onMoveForward={() => {}}
          onZoom={() => {}}
        />
      </TimeRangeProvider>
    );

    const syncButtons = screen.getAllByLabelText('Sync times');
    expect(syncButtons.length).toBe(2);
    await userEvent.click(syncButtons[0]);
    expect(onChange2).toBeCalledWith(value1);
    const unsyncButtons = screen.getAllByLabelText('Unsync times');
    expect(unsyncButtons.length).toBe(2);
  });
});

it('does not submit wrapping forms', async () => {
  const onSubmit = jest.fn();
  render(
    <form onSubmit={onSubmit}>
      <TimeRangePicker
        onChangeTimeZone={() => {}}
        onChange={(value) => {}}
        value={value}
        onMoveBackward={() => {}}
        onMoveForward={() => {}}
        onZoom={() => {}}
      />
    </form>
  );

  const clicks = screen.getAllByRole('button').map((button) => userEvent.click(button));

  await Promise.all(clicks);

  expect(onSubmit).not.toHaveBeenCalled();
});

describe('TimePickerTooltip', () => {
  beforeAll(() => {
    const mockIntl = {
      resolvedOptions: () => ({
        timeZone: 'America/New_York',
      }),
    };

    jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => mockIntl as Intl.DateTimeFormat);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  const timeRange: TimeRange = {
    from: dateTime('2024-01-01T00:00:00Z'),
    to: dateTime('2024-01-02T00:00:00Z'),
    raw: {
      from: dateTime('2024-01-01T00:00:00Z'),
      to: dateTime('2024-01-02T00:00:00Z'),
    },
  };

  it('renders time range with UTC timezone', () => {
    render(<TimePickerTooltip timeRange={timeRange} timeZone="utc" />);

    expect(screen.getByText(/2024-01-01 00:00:00/)).toBeInTheDocument();
    expect(screen.getByText('to')).toBeInTheDocument();
    expect(screen.getByText(/2024-01-02 00:00:00/)).toBeInTheDocument();
    expect(screen.getByText('UTC, GMT')).toBeInTheDocument();
  });

  it('renders time range without timezone if timezone is not passed in', () => {
    render(<TimePickerTooltip timeRange={timeRange} />);
    expect(screen.queryByText('United States, EDT')).not.toBeInTheDocument();
  });

  it('renders time range with browser timezone', () => {
    render(<TimePickerTooltip timeRange={timeRange} timeZone="browser" />);

    expect(screen.getByText('Local browser time')).toBeInTheDocument();
    expect(screen.getByText('United States, EDT')).toBeInTheDocument(); // this was mocked at the beginning, in beforeAll block
  });

  it('renders time range with specific timezone', () => {
    render(<TimePickerTooltip timeRange={timeRange} timeZone="Africa/Accra" />);

    expect(screen.getByText('Ghana, GMT')).toBeInTheDocument();
  });
});
