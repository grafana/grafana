import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { dateTimeParse } from '@grafana/data';

import { TimeRangeFields } from './TimeRangeFields';

it.each([
  { name: 'default sizing', width: undefined, expectedWidth: '100%' },
  { name: 'caller sizing', width: 26, expectedWidth: '208px' },
])('preserves $name without constraining the fields', ({ width, expectedWidth }) => {
  render(
    <TimeRangeFields
      fromInput={{ defaultValue: 'now-1h', width }}
      toInput={{ defaultValue: 'now', width }}
      fieldSuffix={<span data-testid="field-suffix" />}
      calendar={{
        isFullscreen: true,
        from: dateTimeParse('now-1h'),
        to: dateTimeParse('now'),
        onApply: jest.fn(),
        onChange: jest.fn(),
      }}
    />
  );

  for (const input of screen.getAllByTestId('input-wrapper')) {
    expect(input).toHaveStyle({ width: expectedWidth });
  }
  for (const suffix of screen.getAllByTestId('field-suffix')) {
    // Field sizing must remain intrinsic even when its input has an explicit width.
    // eslint-disable-next-line testing-library/no-node-access
    const field = suffix.previousElementSibling!;
    expect(getComputedStyle(field).width).toBe('');
    expect(getComputedStyle(field).maxWidth).toBe('');
  }
});

it('opens an anchored calendar with caller labels and restores trigger focus on Escape', async () => {
  const user = userEvent.setup();
  const anchor = document.createElement('div');
  document.body.appendChild(anchor);
  const onChange = jest.fn();
  const { unmount } = render(
    <TimeRangeFields
      fromLabel="Start"
      toLabel="End"
      fromInput={{ value: '2025-08-07 11:00', onChange }}
      toInput={{ value: '2025-08-07 12:30', onChange }}
      getCalendarAnchor={() => anchor}
      calendar={{
        isFullscreen: true,
        from: dateTimeParse('2025-08-07 11:00', { timeZone: 'America/New_York' }),
        to: dateTimeParse('2025-08-07 12:30', { timeZone: 'America/New_York' }),
        timeZone: 'America/New_York',
        onApply: jest.fn(),
        onChange: jest.fn(),
      }}
    />
  );
  expect(screen.getByRole('textbox', { name: 'Start' })).toHaveValue('2025-08-07 11:00');
  expect(screen.getByRole('textbox', { name: 'End' })).toHaveValue('2025-08-07 12:30');
  const trigger = screen.getAllByRole('button', { name: 'Open calendar' })[0];
  await user.click(trigger);
  expect(await screen.findByRole('dialog')).toBeVisible();
  // Target the calendar; its focused close button has a separate tooltip Escape handler.
  // eslint-disable-next-line testing-library/prefer-user-event
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape', keyCode: 27 });
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  unmount();
  anchor.remove();
});
