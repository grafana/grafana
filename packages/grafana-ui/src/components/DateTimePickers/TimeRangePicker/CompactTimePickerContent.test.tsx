import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { rangeUtil, store } from '@grafana/data';

import { TimeRangePicker, type TimeRangePickerProps } from '../TimeRangePicker';

import { TimeRangePickerContext } from './TimeRangePickerContext';

const value = rangeUtil.convertRawToRange({ from: '2021-06-17 00:00:00', to: '2021-06-19 23:59:00' }, 'utc');

function setup(overrides: Partial<TimeRangePickerProps> = {}, contextDesign: 'legacy' | 'tabs' = 'legacy') {
  const onChange = jest.fn();
  const view = render(
    <TimeRangePicker
      value={value}
      timeZone="utc"
      onChange={onChange}
      onChangeTimeZone={jest.fn()}
      onMoveBackward={jest.fn()}
      onMoveForward={jest.fn()}
      onZoom={jest.fn()}
      compactDesign="tabs"
      layout="compact"
      rememberLastTab={false}
      {...overrides}
    />,
    {
      wrapper: ({ children }) => (
        <TimeRangePickerContext.Provider value={contextDesign}>{children}</TimeRangePickerContext.Provider>
      ),
    }
  );
  return {
    ...view,
    onChange,
    user: userEvent.setup(),
    open: () => userEvent.click(screen.getByRole('button', { name: /Time range selected/ })),
  };
}

afterEach(() => localStorage.clear());

it('keeps the compact legacy form unless opted in', async () => {
  const { open } = setup({ compactDesign: undefined });
  await open();
  expect(screen.getByRole('button', { name: 'Absolute time range' })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
});

it('focuses quick range search and applies a custom duration on Enter', async () => {
  const { open, user, onChange } = setup();
  await open();
  const search = screen.getByRole('textbox', { name: 'Search quick ranges' });
  expect(search).toHaveFocus();
  await user.type(search, '3h{Enter}');
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ raw: { from: 'now-3h', to: 'now' } }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('does not apply an empty search result', async () => {
  const { open, user, onChange } = setup();
  await open();
  await user.type(screen.getByRole('textbox', { name: 'Search quick ranges' }), 'no matching range{Enter}');
  expect(screen.getByRole('tab', { name: 'Relative' })).toHaveAttribute('aria-selected', 'true');
  expect(onChange).not.toHaveBeenCalled();
});

it.each([true, false])('remembers the selected tab only when persistence is %s', async (rememberLastTab) => {
  const { open, user } = setup({ rememberLastTab });
  await open();
  await user.click(screen.getByRole('tab', { name: 'Absolute' }));
  await user.keyboard('{Escape}');
  await open();
  expect(screen.getByRole('tab', { name: rememberLastTab ? 'Absolute' : 'Relative' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  expect(localStorage.getItem('grafana.timepicker.tab')).toBe(rememberLastTab ? 'absolute' : null);
});

it('shows history on Absolute and applies its range in the supplied timezone', async () => {
  const { open, user, onChange } = setup({ history: [value] });
  await open();
  await user.click(screen.getByRole('tab', { name: 'Absolute' }));
  await user.click(screen.getByRole('checkbox', { name: '2021-06-17 00:00:00 to 2021-06-19 23:59:00' }));
  expect(onChange.mock.calls[0][0].from.toISOString()).toBe('2021-06-17T00:00:00.000Z');
});

it('discards inline calendar edits on Cancel', async () => {
  const { open, user, onChange } = setup({ defaultTab: 'absolute' });
  await open();
  await user.click(screen.getAllByRole('button', { name: 'Open calendar' })[0]);
  expect(screen.getByRole('dialog', { name: 'Calendar' })).toBeVisible();
  expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
  await user.click(screen.getByLabelText('June 10, 2021'));
  await user.click(screen.getByLabelText('June 11, 2021'));
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByLabelText('From')).toHaveValue('2021-06-17 00:00:00');
  expect(onChange).not.toHaveBeenCalled();
});

it('updates inputs from the calendar and allows editing times before applying the range', async () => {
  const { open, user, onChange } = setup({ defaultTab: 'absolute' });
  await open();
  await user.click(screen.getAllByRole('button', { name: 'Open calendar' })[0]);
  await user.click(screen.getByLabelText('June 10, 2021'));
  await user.click(screen.getByLabelText('June 11, 2021'));
  await user.click(screen.getByRole('button', { name: 'Update inputs' }));
  expect(screen.getByLabelText('From')).toHaveValue('2021-06-10 00:00:00');
  expect(screen.getByLabelText('To')).toHaveValue('2021-06-11 23:59:59');
  expect(screen.getByLabelText('From')).toHaveFocus();
  expect(onChange).not.toHaveBeenCalled();

  await user.clear(screen.getByLabelText('From'));
  await user.type(screen.getByLabelText('From'), '2021-06-10 10:30:00');
  await user.clear(screen.getByLabelText('To'));
  await user.type(screen.getByLabelText('To'), '2021-06-11 11:45:00');
  await user.click(screen.getByRole('button', { name: 'Apply time range' }));
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange.mock.calls[0][0].from.toISOString()).toBe('2021-06-10T10:30:00.000Z');
  expect(onChange.mock.calls[0][0].to.toISOString()).toBe('2021-06-11T11:45:00.000Z');
});

it('validates absolute input before applying', async () => {
  const { open, user, onChange } = setup({ hideQuickRanges: true });
  await open();
  await user.clear(screen.getByLabelText('From'));
  await user.type(screen.getByLabelText('From'), 'invalid');
  await user.click(screen.getByRole('button', { name: 'Apply time range' }));
  expect(await screen.findByText(/Enter a date/)).toBeVisible();
  expect(onChange).not.toHaveBeenCalled();
});

it('keeps the desktop two-column form when wide layout is forced', async () => {
  const { open } = setup({ layout: 'wide' });
  await open();
  expect(screen.getByLabelText('From')).toHaveValue('2021-06-17 00:00:00');
  expect(screen.getByPlaceholderText('Search quick ranges')).toBeVisible();
  expect(screen.queryByRole('tab', { name: 'Relative' })).not.toBeInTheDocument();
});

it('hides fiscal-year settings independently of timezone settings', async () => {
  const { open, user } = setup({ layout: 'wide', hideFiscalYear: true });
  await open();
  await user.click(screen.getByRole('button', { name: 'Change time settings' }));
  expect(screen.getByRole('tab', { name: 'Time zone' })).toBeVisible();
  expect(screen.queryByRole('tab', { name: 'Fiscal year' })).not.toBeInTheDocument();
});

it('hides history and uses the configured default when persistence is disabled', async () => {
  localStorage.setItem('grafana.timepicker.tab', 'relative');
  const { open } = setup({ defaultTab: 'absolute', showHistory: false, history: [value] });
  await open();
  expect(screen.getByRole('tab', { name: 'Absolute' })).toHaveAttribute('aria-selected', 'true');
  expect(
    screen.queryByRole('checkbox', { name: '2021-06-17 00:00:00 to 2021-06-19 23:59:00' })
  ).not.toBeInTheDocument();
});

it('returns from inline calendar with Escape without dismissing the picker', async () => {
  const { open, user } = setup({ defaultTab: 'absolute' });
  await open();
  await user.click(screen.getAllByRole('button', { name: 'Open calendar' })[0]);
  await user.keyboard('{Escape}');
  expect(screen.getByRole('dialog', { name: 'Time range picker' })).toBeVisible();
  expect(screen.getByLabelText('From')).toHaveValue('2021-06-17 00:00:00');
});

it('supports an explicit modal calendar in tabbed compact layout', async () => {
  const { open, user } = setup({ defaultTab: 'absolute', calendarDisplay: 'modal' });
  await open();
  await user.click(screen.getAllByRole('button', { name: 'Open calendar' })[0]);
  expect(screen.getByText('Select a time range')).toBeVisible();
  expect(screen.getByLabelText('From')).toHaveValue('2021-06-17 00:00:00');
});

it('allows an explicit legacy prop to override a tabbed context', async () => {
  const { open } = setup({ compactDesign: 'legacy' }, 'tabs');
  await open();
  expect(screen.getByRole('button', { name: 'Absolute time range' })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
});

it.each(['compact', 'wide'] as const)(
  'uses only consumer presets in their supplied order in %s layout',
  async (layout) => {
    const { open, user, onChange } = setup({
      layout,
      showHistory: false,
      quickRanges: [
        { from: 'now-2h', to: 'now', display: 'Two hours' },
        { from: 'now-15m', to: 'now', display: 'Quarter hour' },
      ],
    });
    await open();
    const options = screen.getAllByRole('checkbox');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAccessibleName('Two hours');
    expect(options[1]).toHaveAccessibleName('Quarter hour');
    expect(screen.queryByRole('checkbox', { name: 'Last 5 minutes' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Quarter hour' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ raw: { from: 'now-15m', to: 'now' } }));
  }
);

it('accepts an empty preset list while retaining custom-duration search', async () => {
  const { open, user, onChange } = setup({ quickRanges: [] });
  await open();
  const search = screen.getByRole('textbox', { name: 'Search quick ranges' });
  expect(search).toHaveFocus();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  await user.type(search, '3h{Enter}');
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ raw: { from: 'now-3h', to: 'now' } }));
});

it.each([true, false])(
  'still applies ranges when storage is blocked and tab persistence is %s',
  async (rememberLastTab) => {
    const storage = jest.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Storage blocked by host', 'SecurityError');
    });
    try {
      const { open, user, onChange, unmount } = setup({ rememberLastTab, showHistory: false });
      await open();
      await user.click(screen.getByRole('tab', { name: 'Absolute' }));
      await user.keyboard('{Escape}');
      await open();
      expect(screen.getByRole('tab', { name: rememberLastTab ? 'Absolute' : 'Relative' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await user.click(screen.getByRole('tab', { name: 'Relative' }));
      await user.type(screen.getByRole('textbox', { name: 'Search quick ranges' }), '3h{Enter}');
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ raw: { from: 'now-3h', to: 'now' } }));
      unmount();
    } finally {
      store.delete('grafana.timepicker.tab');
      storage.mockRestore();
    }
  }
);
