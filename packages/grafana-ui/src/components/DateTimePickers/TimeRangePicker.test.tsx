import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { dateTime, TimeRange } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';

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
});
