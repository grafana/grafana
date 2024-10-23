import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { dateTime } from '@grafana/data';

import { TimeRangeInput } from './TimeRangeInput';

describe('TimeRangeInput', () => {
  // TODO: This test is evergreen - the check that we haven't accidentally closed
  // the picker still passes without the appropriate fix
  // Seems to be related to jest-dom and how it handles clicking outside the node etc.
  it('handles selecting dates over multiple months', async () => {
    const user = userEvent.setup();
    const from = dateTime('2024-01-01T00:00:00Z');
    const to = dateTime('2024-01-01T00:00:00Z');
    const onChange = jest.fn();

    render(
      <TimeRangeInput
        timeZone="utc"
        onChange={(payload) => {
          const { from, to } = payload;
          onChange({ from: from.toString(), to: to.toString() });
        }}
        value={{
          from,
          to,
          raw: {
            from,
            to,
          },
        }}
      />
    );

    // TimeRangeInput renders as a button that looks like an input -
    // the only one we can see at the start is the button to open the picker
    await user.click(screen.getByRole('button'));

    const [firstOpenCalendarButton] = await screen.findAllByRole('button', { name: /open calendar/i });
    await user.click(firstOpenCalendarButton);

    // Select two dates that are on different "screens" of the calendar picker - this is where the bug would occur
    await user.click(await screen.findByLabelText(/january 1, 2024/i));
    await user.click(await screen.findByLabelText(/next month/i));
    await user.click(await screen.findByLabelText(/february 28, 2024/i));

    await user.click(await screen.findByText(/apply time range/i));

    expect(onChange).toHaveBeenCalledWith({
      from: 'Mon Jan 01 2024 00:00:00 GMT+0000',
      to: 'Wed Feb 28 2024 23:59:59 GMT+0000',
    });
  });
});
