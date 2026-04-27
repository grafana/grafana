import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type Field, FieldType } from '@grafana/data';

import { type FilterType } from '../types';

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
  const setFilter = jest.fn();
  const onClose = jest.fn();

  const result = render(
    <FilterPopup
      name="Status"
      rows={makeRows('Status', ['active', 'inactive'])}
      filterValue={undefined}
      setFilter={setFilter}
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

  return { setFilter, onClose, buttonElement, ...result };
}

describe('FilterPopup', () => {
  afterEach(() => {
    // clean up any button elements added to body
    document.body.querySelectorAll('button').forEach((b) => b.remove());
  });

  describe('Cancel button', () => {
    it('calls onClose without modifying the filter', async () => {
      const user = userEvent.setup();
      const { setFilter, onClose } = renderPopup();

      await user.click(screen.getByText('Cancel'));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(setFilter).not.toHaveBeenCalled();
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

    it('removes the filter key and closes when clicked', async () => {
      const user = userEvent.setup();
      const { setFilter, onClose } = renderPopup({
        filterValue: [{ value: 'active', label: 'active' }],
      });

      await user.click(screen.getByText('Clear filter'));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(setFilter).toHaveBeenCalledTimes(1);

      // setFilter is called with an updater; run it to verify the key is deleted
      const updater: (f: FilterType) => FilterType = setFilter.mock.calls[0][0];
      const before: FilterType = {
        Status: { filteredSet: new Set(['active']), displayName: 'Status', filtered: [{ value: 'active' }] },
      };
      const after = updater(before);
      expect(after).not.toHaveProperty('Status');
    });
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
      const { setFilter } = renderPopup({
        filterValue: [{ value: 'active', label: 'active' }],
      });

      await user.click(screen.getByText('Ok'));

      expect(setFilter).toHaveBeenCalledTimes(1);
      const updater: (f: FilterType) => FilterType = setFilter.mock.calls[0][0];
      const result = updater({});

      expect(result).toHaveProperty('Status');
      expect(result.Status.filtered?.map((v) => v.value)).toEqual(['active']);
      expect(result.Status.filteredSet).toEqual(new Set(['active']));
      expect(result.Status.displayName).toBe('Status');
    });

    it('deletes the filter key when Ok is clicked with no items selected', async () => {
      const user = userEvent.setup();
      // No filterValue means no items are pre-selected; clicking Ok should clear the key.
      const { setFilter } = renderPopup({ filterValue: undefined });

      await user.click(screen.getByText('Ok'));

      expect(setFilter).toHaveBeenCalledTimes(1);
      const updater: (f: FilterType) => FilterType = setFilter.mock.calls[0][0];
      const before: FilterType = {
        Status: { filteredSet: new Set(['active']), displayName: 'Status' },
      };
      const after = updater(before);
      expect(after).not.toHaveProperty('Status');
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

  describe('parentIndex', () => {
    it('uses a composite key when parentIndex is provided', async () => {
      const user = userEvent.setup();
      const { setFilter } = renderPopup({
        filterValue: [{ value: 'active', label: 'active' }],
        parentIndex: 3,
      });

      await user.click(screen.getByText('Ok'));

      const updater: (f: FilterType) => FilterType = setFilter.mock.calls[0][0];
      const result = updater({});

      expect(result).toHaveProperty('Status-3');
      expect(result['Status-3'].parentIndex).toBe(3);
    });
  });
});
