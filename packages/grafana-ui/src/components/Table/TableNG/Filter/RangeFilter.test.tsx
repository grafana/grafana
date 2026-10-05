import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FieldType, toDataFrame } from '@grafana/data';

import { compileFrameToRecords } from '../utils';

import { RangeFilter, rangeHistogram } from './RangeFilter';

function setup(type = FieldType.number, values: Array<number | null> = [0, 1, 1, 2, 10, null, Infinity]) {
  const data = toDataFrame({ fields: [{ name: 'Value', type, values }] });
  const onApply = jest.fn();
  const onClear = jest.fn();
  const onCancel = jest.fn();
  const rows = compileFrameToRecords(['Value'])(data);
  render(
    <RangeFilter
      field={data.fields[0]}
      rows={rows}
      timeZone="America/New_York"
      onApply={onApply}
      onClear={onClear}
      onCancel={onCancel}
    />
  );
  return { user: userEvent.setup(), onApply, onClear, onCancel };
}

it('bins the full finite distribution without counting missing values as zero', () => {
  expect(rangeHistogram([null, Infinity, NaN, -1, -1, 0, 29]).bins).toEqual([2, 1, ...Array(27).fill(0), 1]);
  expect(rangeHistogram([null, Infinity, NaN]).missing).toBe(3);
  expect(rangeHistogram([7, 7]).bins).toEqual([2]);
});

it('previews exact bounds and missing values, then commits only on Apply', async () => {
  const { user, onApply } = setup();
  await user.type(screen.getByRole('textbox', { name: 'Minimum' }), '1');
  await user.type(screen.getByRole('textbox', { name: 'Maximum' }), '2');
  expect(screen.getByRole('status')).toHaveTextContent('3 of 7 rows match');
  expect(onApply).not.toHaveBeenCalled();
  await user.click(screen.getByRole('checkbox'));
  expect(screen.getByRole('status')).toHaveTextContent('5 of 7 rows match');
  await user.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onApply).toHaveBeenCalledWith({ min: 1, max: 2, includeMissing: true });
});

it('rejects reversed bounds and supports cancellation without applying', async () => {
  const { user, onApply, onCancel } = setup();
  await user.type(screen.getByRole('textbox', { name: 'Minimum' }), '20');
  await user.type(screen.getByRole('textbox', { name: 'Maximum' }), '2');
  expect(screen.getByRole('alert')).toHaveTextContent('minimum no greater than maximum');
  expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onApply).not.toHaveBeenCalled();
});

it('converts date bounds in the host timezone to absolute timestamps', async () => {
  const { user, onApply } = setup(FieldType.time, [Date.UTC(2026, 8, 17, 16), Date.UTC(2026, 8, 17, 17)]);
  await user.type(screen.getByLabelText('Start'), '2026-09-17 12:00:00.000');
  await user.type(screen.getByLabelText('End'), '2026-09-17 12:30:00.000');
  expect(screen.getByRole('status')).toHaveTextContent('1 of 2 rows match');
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
  expect(screen.getByRole('status')).toHaveTextContent('2 of 2 rows match');
  expect(onApply).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onApply).toHaveBeenCalledWith({ min: 1789617600000, max: 1789790399999, includeMissing: false });
});
