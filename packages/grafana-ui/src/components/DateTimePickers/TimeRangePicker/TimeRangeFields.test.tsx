import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';

import { dateTimeParse } from '@grafana/data';

import { TimeRangeFields } from './TimeRangeFields';

it('passes empty bounds and millisecond text to the caller without parsing', async () => {
  const user = userEvent.setup();
  const onChange = jest.fn();
  const onBlur = jest.fn();
  const inputRef = createRef<HTMLInputElement>();
  function ControlledFields() {
    const [value, setValue] = useState('2025-08-07 11:00:00.123');
    return (
      <TimeRangeFields
        from={{
          value,
          onChange: (next) => {
            setValue(next);
            onChange(next);
          },
          onBlur,
          inputRef,
          placeholder: 'No limit',
        }}
        to={{ value: '', onChange: jest.fn() }}
        calendarAnchor={{ current: null }}
        calendar={{
          isFullscreen: true,
          from: dateTimeParse('2025-08-07'),
          to: dateTimeParse('2025-08-08'),
          onApply: jest.fn(),
          onChange: jest.fn(),
        }}
      />
    );
  }
  render(<ControlledFields />);
  const from = screen.getByLabelText('From');
  expect(inputRef.current).toBe(from);
  await user.clear(from);
  expect(onChange).toHaveBeenLastCalledWith('');
  expect(screen.getByPlaceholderText('No limit')).toHaveValue('');
  await user.type(from, '2025-08-07 11:00:00.456');
  await user.tab();
  expect(onChange).toHaveBeenLastCalledWith('2025-08-07 11:00:00.456');
  expect(from).toHaveValue('2025-08-07 11:00:00.456');
  expect(onBlur).toHaveBeenCalledTimes(1);
});

it.each([
  { name: 'default sizing', width: undefined, expectedWidth: '100%' },
  { name: 'caller sizing', width: 26, expectedWidth: '208px' },
])('preserves $name without constraining the fields', ({ width, expectedWidth }) => {
  render(
    <TimeRangeFields
      from={{ value: 'now-1h', onChange: jest.fn() }}
      to={{ value: 'now', onChange: jest.fn() }}
      inputWidth={width}
      calendarAnchor={{ current: null }}
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
      from={{ label: 'Start', value: '2025-08-07 11:00', onChange }}
      to={{ label: 'End', value: '2025-08-07 12:30', onChange }}
      calendarAnchor={{ current: anchor }}
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
