import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTheme, FieldType, getDisplayProcessor, toDataFrame } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { compileFrameToRecords } from '../utils';

import { DateRangeFilter } from './DateRangeFilter';
import { NumericRangeFilter } from './NumericRangeFilter';
function setup(
  type = FieldType.number,
  values: Array<number | null> = [0, 1, 1, 2, 10, null, Infinity],
  range?: { min?: number; max?: number; includeMissing: boolean }
) {
  const data = toDataFrame({ fields: [{ name: 'Value', type, values }] });
  const onApply = jest.fn();
  const onClear = jest.fn();
  const onCancel = jest.fn();
  const rows = compileFrameToRecords(['Value'])(data);
  const props = {
    field: data.fields[0],
    rows,
    timeZone: 'America/New_York',
    onApply,
    onClear,
    onCancel,
  };
  const Filter = type === FieldType.time ? DateRangeFilter : NumericRangeFilter;
  const view = render(<Filter {...props} range={range} />);
  return {
    user: userEvent.setup(),
    onApply,
    onClear,
    onCancel,
    rerender: (range?: { min?: number; max?: number; includeMissing: boolean }) =>
      view.rerender(<Filter {...props} range={range} />),
    rerenderTimeZone: (timeZone: string) => view.rerender(<Filter {...props} range={range} timeZone={timeZone} />),
  };
}

it.each([FieldType.number, FieldType.time])('shows Clear filter only for an active %s range filter', async (type) => {
  const { user, onClear, rerender } = setup(type);
  expect(screen.queryByRole('button', { name: 'Clear filter' })).not.toBeInTheDocument();

  rerender({ min: 1, max: 2, includeMissing: false });
  await user.click(screen.getByRole('button', { name: 'Clear filter' }));
  expect(onClear).toHaveBeenCalledTimes(1);
});

it.each([FieldType.number, FieldType.time])('preserves and toggles missing values for %s filters', async (type) => {
  const { user, onApply } = setup(type, [1, null, 2], { min: 1, max: 2, includeMissing: true });
  expect(screen.getByRole('checkbox', { name: 'Include missing values' })).toBeChecked();
  expect(screen.getByRole('status')).toHaveTextContent('3 of 3 rows');
  await user.click(screen.getByRole('checkbox', { name: 'Include missing values' }));
  expect(screen.getByRole('status')).toHaveTextContent('2 of 3 rows');
  await user.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onApply).toHaveBeenCalledWith({ min: 1, max: 2, includeMissing: false });
});

it('shows date extent as placeholders and limits calendar days in the dashboard timezone', async () => {
  const { user } = setup(FieldType.time, [Date.UTC(2026, 8, 17, 2), Date.UTC(2026, 8, 18, 2)]);
  expect(screen.getByRole('textbox', { name: 'Start' })).toHaveAttribute('placeholder', '2026-09-16 22:00:00.000');
  expect(screen.getByRole('textbox', { name: 'End' })).toHaveAttribute('placeholder', '2026-09-17 22:00:00.000');

  await user.click(screen.getAllByRole('button', { name: 'Open calendar' })[0]);
  expect(screen.getByRole('button', { name: 'September 15, 2026' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'September 16, 2026' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'September 17, 2026' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'September 18, 2026' })).toBeDisabled();
});

it('keeps typed dates outside the calendar extent available as exact bounds', async () => {
  const { user, onApply } = setup(FieldType.time, [Date.UTC(2026, 8, 17, 16), Date.UTC(2026, 8, 17, 17)]);
  await user.type(screen.getByRole('textbox', { name: 'Start' }), '2026-09-16 12:00:00.000');
  await user.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onApply).toHaveBeenCalledWith({ min: Date.UTC(2026, 8, 16, 16), max: undefined, includeMissing: false });
});

it('keeps drafted date bounds at the same instants when the timezone changes', async () => {
  const start = Date.UTC(2026, 8, 17, 16);
  const end = Date.UTC(2026, 8, 17, 18);
  const { user, onApply, rerenderTimeZone } = setup(FieldType.time, [start, end], {
    min: start,
    max: end,
    includeMissing: false,
  });

  const startInput = screen.getByRole('textbox', { name: 'Start' });
  const endInput = screen.getByRole('textbox', { name: 'End' });
  await user.clear(startInput);
  await user.type(startInput, '2026-09-17 13:00:00.000');

  rerenderTimeZone('UTC');
  expect(startInput).toHaveValue('2026-09-17 17:00:00.000');
  expect(endInput).toHaveValue('2026-09-17 18:00:00.000');

  await user.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onApply).toHaveBeenCalledWith({ min: Date.UTC(2026, 8, 17, 17), max: end, includeMissing: false });
});

it('disables calendar selection and uses unbounded placeholders with no finite dates', () => {
  setup(FieldType.time, [null, Infinity]);
  expect(screen.getByRole('textbox', { name: 'Start' })).toHaveAttribute('placeholder', 'No limit');
  expect(screen.getByRole('textbox', { name: 'End' })).toHaveAttribute('placeholder', 'No limit');
  expect(screen.getAllByRole('button', { name: 'Open calendar' })[0]).toBeDisabled();
});

it('previews exact bounds without missing values, then commits only on Apply', async () => {
  const { user, onApply } = setup();
  await user.type(screen.getByRole('textbox', { name: 'Minimum' }), '1');
  await user.type(screen.getByRole('textbox', { name: 'Maximum' }), '2');
  expect(screen.getByRole('slider', { name: 'Minimum' })).toHaveAttribute('aria-valuenow', '1');
  expect(screen.getByRole('slider', { name: 'Maximum' })).toHaveAttribute('aria-valuenow', '2');
  expect(screen.getByRole('status')).toHaveTextContent('3 of 7 rows');
  expect(onApply).not.toHaveBeenCalled();
  expect(screen.getByRole('checkbox', { name: 'Include missing values' })).not.toBeChecked();
  await user.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onApply).toHaveBeenCalledWith({ min: 1, max: 2, includeMissing: false });
});

it('rejects reversed bounds and supports cancellation without applying', async () => {
  const { user, onApply, onCancel } = setup();
  await user.type(screen.getByRole('textbox', { name: 'Minimum' }), '20');
  await user.type(screen.getByRole('textbox', { name: 'Maximum' }), '2');
  const alert = screen.getByRole('alert');
  expect(alert).toHaveTextContent('minimum no greater than maximum');
  expect(alert.querySelector('svg')).toBeInTheDocument();
  for (const name of ['Minimum', 'Maximum']) {
    const input = screen.getByRole('textbox', { name });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', alert.id);
  }
  expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onApply).not.toHaveBeenCalled();
});

it.each([
  [FieldType.number, 'Minimum', 'Maximum'],
  [FieldType.time, 'Start', 'End'],
])('marks only the malformed %s bound invalid', async (type, firstLabel, secondLabel) => {
  const { user } = setup(type);
  await user.type(screen.getByRole('textbox', { name: firstLabel }), 'invalid');
  const alert = screen.getByRole('alert');
  expect(alert).toHaveTextContent('Enter valid bounds');
  expect(screen.getByRole('textbox', { name: firstLabel })).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('textbox', { name: firstLabel })).toHaveAttribute('aria-describedby', alert.id);
  expect(screen.getByRole('textbox', { name: secondLabel })).toHaveAttribute('aria-invalid', 'false');
  expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
});

it('marks both date inputs invalid when the start exceeds the end', async () => {
  const { user } = setup(FieldType.time);
  await user.type(screen.getByRole('textbox', { name: 'Start' }), '2026-09-18 12:00:00.000');
  await user.type(screen.getByRole('textbox', { name: 'End' }), '2026-09-17 12:00:00.000');
  expect(screen.getByRole('textbox', { name: 'Start' })).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('textbox', { name: 'End' })).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('alert')).toHaveTextContent('minimum no greater than maximum');
});

it('converts date bounds in the host timezone to absolute timestamps', async () => {
  const { user, onApply } = setup(FieldType.time, [Date.UTC(2026, 8, 17, 16), Date.UTC(2026, 8, 17, 17)]);
  await user.type(screen.getByLabelText('Start'), '2026-09-17 12:00:00.000');
  await user.type(screen.getByLabelText('End'), '2026-09-17 12:30:00.000');
  expect(screen.getByRole('status')).toHaveTextContent('1 of 2 rows');
  await user.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onApply).toHaveBeenCalledWith({ min: 1789660800000, max: 1789662600000, includeMissing: false });
});

it('selects whole days with the dashboard calendar and applies only on confirmation', async () => {
  const { user, onApply } = setup(FieldType.time, [1789660800000, 1789747200000]);
  await user.click(screen.getAllByRole('button', { name: 'Open calendar' })[0]);
  await user.click(screen.getByRole('button', { name: 'September 17, 2026' }));
  await user.click(screen.getByRole('button', { name: 'September 18, 2026' }));
  await user.click(screen.getByRole('button', { name: 'Close calendar' }));
  expect(screen.getByLabelText('Start')).toHaveValue('2026-09-17 00:00:00.000');
  expect(screen.getByLabelText('End')).toHaveValue('2026-09-18 23:59:59.999');
  expect(screen.getByRole('status')).toHaveTextContent('2 of 2 rows');
  expect(onApply).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onApply).toHaveBeenCalledWith({ min: 1789617600000, max: 1789790399999, includeMissing: false });
});

it('keeps millisecond precision with an unbounded end date', async () => {
  const { user, onApply } = setup(FieldType.time, [1789660800122, 1789660800123, 1789660800124]);
  await user.type(screen.getByLabelText('Start'), '2026-09-17 12:00:00.123');
  expect(screen.getByLabelText('End')).toHaveValue('');
  expect(screen.getByRole('status')).toHaveTextContent('2 of 3 rows');
  await user.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onApply).toHaveBeenCalledWith({ min: 1789660800123, max: undefined, includeMissing: false });
});

it.each([FieldType.number, FieldType.time])(
  'clears an unbounded %s range without dropping missing rows',
  async (type) => {
    const { user, onClear, onApply } = setup(type, [1, null, 2]);
    expect(screen.getByRole('status')).toHaveTextContent('3 of 3 rows');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  }
);

it('keeps raw fractional endpoints when moving the slider to its limits', async () => {
  const { user, onApply } = setup(FieldType.number, [8.005, 10.004, 12.123456, 15.98765, null], {
    min: 10,
    max: 14,
    includeMissing: false,
  });
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Minimum' })).toHaveFocus());
  act(() => screen.getByRole('slider', { name: 'Minimum' }).focus());
  // rc-slider reads legacy keyCode, which userEvent does not populate.
  // eslint-disable-next-line testing-library/prefer-user-event
  fireEvent.keyDown(screen.getByRole('slider', { name: 'Minimum' }), { key: 'Home', keyCode: 36 });
  act(() => screen.getByRole('slider', { name: 'Maximum' }).focus());
  // eslint-disable-next-line testing-library/prefer-user-event
  fireEvent.keyDown(screen.getByRole('slider', { name: 'Maximum' }), { key: 'End', keyCode: 35 });
  expect(screen.getByRole('status')).toHaveTextContent('4 of 5 rows');
  await user.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onApply).toHaveBeenCalledWith({ min: 8.005, max: 15.98765, includeMissing: false });
});

it('exposes separate start and end calendar field scopes', async () => {
  const { user } = setup(FieldType.time, [Date.UTC(2026, 8, 17), Date.UTC(2026, 8, 18)]);
  const range = selectors.components.Panels.Visualization.TableNG.Filters.Range;
  expect(within(screen.getByTestId(range.field('minimum'))).getByRole('textbox')).toHaveAccessibleName('Start');
  const end = within(screen.getByTestId(range.field('maximum')));
  expect(end.getByRole('textbox')).toHaveAccessibleName('End');
  await user.click(end.getByRole('button', { name: 'Open calendar' }));
  expect(screen.getByRole('button', { name: 'Close calendar' })).toBeInTheDocument();
});

it.each(['percentunit', 'short'])('moves slider bounds in raw units with %s formatting', async (unit) => {
  const data = toDataFrame({
    fields: [{ name: 'Value', type: FieldType.number, values: [0.8, 0.85, 0.95], config: { unit, decimals: 1 } }],
  });
  const field = data.fields[0];
  field.display = getDisplayProcessor({ field, theme: createTheme() });
  const onApply = jest.fn();
  render(
    <NumericRangeFilter
      field={field}
      rows={compileFrameToRecords(['Value'])(data)}
      range={{ min: 0.85, max: 0.95, includeMissing: false }}
      onApply={onApply}
      onClear={jest.fn()}
      onCancel={jest.fn()}
    />
  );
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Minimum' })).toHaveFocus());
  act(() => screen.getByRole('slider', { name: 'Minimum' }).focus());
  // rc-slider reads legacy keyCode, which userEvent does not populate.
  // eslint-disable-next-line testing-library/prefer-user-event
  fireEvent.keyDown(screen.getByRole('slider', { name: 'Minimum' }), { key: 'ArrowLeft', keyCode: 37 });
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onApply.mock.calls[0][0].min).toBeGreaterThan(0.84);
  expect(onApply.mock.calls[0][0].min).toBeLessThan(0.85);
  expect(onApply.mock.calls[0][0].max).toBe(0.95);
});

it.each([FieldType.number, FieldType.time])('preserves includeMissing when reapplying a %s range', async (type) => {
  const { user, onApply } = setup(type, [1, null, 2], { min: 1, max: 2, includeMissing: true });
  await user.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onApply).toHaveBeenCalledWith({ min: 1, max: 2, includeMissing: true });
});

it.each([
  [FieldType.number, 'Minimum', 'Maximum'],
  [FieldType.time, 'Start', 'End'],
])('clears an existing %s range after deleting both bounds', async (type, minimum, maximum) => {
  const { user, onClear, onApply } = setup(type, [1, null, 2], { min: 1, max: 2, includeMissing: false });
  await user.clear(screen.getByRole('textbox', { name: minimum }));
  await user.clear(screen.getByRole('textbox', { name: maximum }));
  expect(screen.getByRole('status')).toHaveTextContent('3 of 3 rows');
  await user.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onClear).toHaveBeenCalledTimes(1);
  expect(onApply).not.toHaveBeenCalled();
});

it.each([
  [FieldType.number, 'Minimum', '1'],
  [FieldType.time, 'Start', '1970-01-01 00:00:00.001'],
])('shows missing-value control only while a %s range has a bound', async (type, label, bound) => {
  const { user } = setup(type, [1, null, 2]);
  expect(screen.getByRole('status')).toHaveTextContent('3 of 3 rows');
  expect(screen.queryByRole('checkbox', { name: 'Include missing values' })).not.toBeInTheDocument();

  const input = screen.getByRole('textbox', { name: label });
  await user.type(input, bound);
  const checkbox = screen.getByRole('checkbox', { name: 'Include missing values' });
  expect(checkbox).toBeEnabled();
  await user.click(checkbox);

  await user.clear(input);
  expect(screen.queryByRole('checkbox', { name: 'Include missing values' })).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('3 of 3 rows');

  await user.type(input, bound);
  expect(screen.getByRole('checkbox', { name: 'Include missing values' })).toBeChecked();
});
