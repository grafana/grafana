import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { dateTime, makeTimeRange, TimeRange } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';

import { TimeRangeProvider } from './TimeRangeContext';
import { TimeRangePicker } from './TimeRangePicker';

const selectors = e2eSelectors.components.TimePicker;

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
  const container = render(
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

  const clicks = container.getAllByRole('button').map((button) => userEvent.click(button));

  await Promise.all(clicks);

  expect(onSubmit).not.toHaveBeenCalled();
});
