import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type Field, FieldType } from '@grafana/data';

import { FilterPopup } from './FilterPopup';
import { operatorSelectableValues } from './utils';

function makeField(name: string): Field {
  return { name, type: FieldType.string, values: ['active', 'inactive'], config: {} };
}

function makeRows(fieldName: string, values: string[]) {
  return values.map((v, i) => ({ __depth: 0, __index: i, [fieldName]: v }));
}

const defaultOperator = operatorSelectableValues()['Contains' as const];

function renderPopup(overrides: Partial<Parameters<typeof FilterPopup>[0]> = {}) {
  const buttonElement = document.createElement('button');
  document.body.appendChild(buttonElement);
  const onApplyValues = jest.fn();
  const onClear = jest.fn();
  const onClose = jest.fn();

  const view = render(
    <FilterPopup
      rows={makeRows('Status', ['active', 'inactive'])}
      filterValue={undefined}
      onApplyValues={onApplyValues}
      onClear={onClear}
      onClose={onClose}
      field={makeField('Status')}
      searchFilter=""
      setSearchFilter={jest.fn()}
      operator={defaultOperator}
      setOperator={jest.fn()}
      buttonElement={buttonElement}
      {...overrides}
    />
  );

  return { onApplyValues, onClear, onClose, buttonElement, ...view };
}

describe('FilterPopup', () => {
  afterEach(() => {
    // clean up any button elements added to body
    document.body.querySelectorAll('button').forEach((b) => b.remove());
  });

  it('previews selected string rows, including repeated values', async () => {
    const user = userEvent.setup();
    renderPopup({ rows: makeRows('Status', ['active', 'active', 'inactive']) });
    expect(screen.getByRole('status')).toHaveTextContent('3 of 3 rows');

    await user.click(screen.getByRole('checkbox', { name: 'active' }));
    expect(screen.getByRole('status')).toHaveTextContent('2 of 3 rows');

    await user.click(screen.getByRole('checkbox', { name: 'inactive' }));
    expect(screen.getByRole('status')).toHaveTextContent('3 of 3 rows');

    await user.click(screen.getByRole('checkbox', { name: 'active' }));
    expect(screen.getByRole('status')).toHaveTextContent('1 of 3 rows');

    await user.click(screen.getByRole('checkbox', { name: 'inactive' }));
    expect(screen.getByRole('status')).toHaveTextContent('3 of 3 rows');
  });

  describe('Cancel button', () => {
    it('calls onClose without modifying the filter', async () => {
      const user = userEvent.setup();
      const { onApplyValues, onClear, onClose } = renderPopup();

      await user.click(screen.getByText('Cancel'));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onApplyValues).not.toHaveBeenCalled();
      expect(onClear).not.toHaveBeenCalled();
    });
  });

  describe('"Clear filter" button', () => {
    it('is not visible when no filter is active', () => {
      renderPopup({ filterValue: undefined });
      expect(screen.queryByText('Clear filter')).not.toBeInTheDocument();
    });

    it('is visible when a filter value is present', () => {
      renderPopup({ filterValue: [{ value: 'active', label: 'active' }] });
      expect(screen.getByText('Clear filter')).toBeInTheDocument();
    });

    it('clears the filter and closes when clicked', async () => {
      const user = userEvent.setup();
      const { onClear, onClose } = renderPopup({
        filterValue: [{ value: 'active', label: 'active' }],
      });

      await user.click(screen.getByText('Clear filter'));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClear).toHaveBeenCalledTimes(1);
    });
  });

  it.each([FieldType.number, FieldType.time])('clears and closes an active %s range filter', async (type) => {
    const user = userEvent.setup();
    const field: Field = { name: 'Value', type, values: [0, 10], config: {} };
    const { onClear, onClose } = renderPopup({
      field,
      rows: makeRows('Value', ['0', '10']),
      range: { min: 0, max: 10, includeMissing: false },
    });

    await user.click(screen.getByRole('button', { name: 'Clear filter' }));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe('Ok button', () => {
    it('closes when Ok is clicked', async () => {
      const user = userEvent.setup();
      const { onClose } = renderPopup();

      await user.click(screen.getByText('Ok'));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('applies pre-selected filter values when Ok is clicked', async () => {
      const user = userEvent.setup();
      // Pre-select "active" by passing it as a filterValue; FilterPopup will initialise
      // its internal values state from the matching option in the computed options list.
      const { onApplyValues } = renderPopup({
        filterValue: [{ value: 'active', label: 'active' }],
      });

      await user.click(screen.getByText('Ok'));

      expect(onApplyValues).toHaveBeenCalledWith([{ value: 'active', label: 'active' }]);
    });

    it('passes an empty selection when Ok is clicked with no items selected', async () => {
      const user = userEvent.setup();
      // No filterValue means no items are pre-selected; clicking Ok should clear the key.
      const { onApplyValues } = renderPopup({ filterValue: undefined });

      await user.click(screen.getByText('Ok'));

      expect(onApplyValues).toHaveBeenCalledWith([]);
    });
  });

  describe('Escape key', () => {
    it('calls onClose when Escape is pressed', async () => {
      const user = userEvent.setup();
      const { onClose } = renderPopup();

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps the numeric filter open when a slider drag ends outside, then closes on a separate outside click', async () => {
    const user = userEvent.setup();
    const field: Field = { name: 'Value', type: FieldType.number, values: [0, 10], config: {} };
    const { onClose } = renderPopup({ field, rows: makeRows('Value', ['0', '10']) });
    const popup = screen.getByRole('group', { name: 'Filter Value' });

    await user.pointer([
      { target: popup, keys: '[MouseLeft>]' },
      { target: document.body, keys: '[/MouseLeft]' },
    ]);

    expect(screen.getByRole('slider', { name: 'Minimum' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
