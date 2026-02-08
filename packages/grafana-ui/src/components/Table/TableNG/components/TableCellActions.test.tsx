import { render, screen } from '@testing-library/react';

import { Field, FieldType } from '@grafana/data';

import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR } from '../types';

import { TableCellActions } from './TableCellActions';

describe('TableCellActions', () => {
  const setInspectCell = jest.fn();

  beforeEach(() => {
    setInspectCell.mockClear();
  });

  describe('filter actions', () => {
    it('calls onCellFilterAdded with key, value, operator and keyLabel when "Filter for value" is clicked', () => {
      const onCellFilterAdded = jest.fn();
      const field: Field = {
        name: 'Account.Owner.Name',
        type: FieldType.string,
        values: [],
        config: {
          displayNameFromDS: 'Account Owner Name',
        },
      };
      const value = 'CA';

      render(
        <TableCellActions
          field={field}
          value={value}
          displayName={field.config.displayNameFromDS ?? field.name}
          cellInspect={false}
          showFilters={true}
          setInspectCell={setInspectCell}
          onCellFilterAdded={onCellFilterAdded}
        />
      );

      screen.getByRole('button', { name: 'Filter for value' }).click();

      expect(onCellFilterAdded).toHaveBeenCalledTimes(1);
      expect(onCellFilterAdded).toHaveBeenCalledWith({
        key: 'Account.Owner.Name',
        operator: FILTER_FOR_OPERATOR,
        value: 'CA',
        keyLabel: 'Account Owner Name',
      });
    });

    it('calls onCellFilterAdded with keyLabel from field.name when displayNameFromDS is not set', () => {
      const onCellFilterAdded = jest.fn();
      const field: Field = {
        name: 'orders.status',
        type: FieldType.string,
        values: [],
        config: {},
      };

      render(
        <TableCellActions
          field={field}
          value="completed"
          displayName={field.name}
          cellInspect={false}
          showFilters={true}
          setInspectCell={setInspectCell}
          onCellFilterAdded={onCellFilterAdded}
        />
      );

      screen.getByRole('button', { name: 'Filter for value' }).click();

      expect(onCellFilterAdded).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'orders.status',
          value: 'completed',
          operator: FILTER_FOR_OPERATOR,
          keyLabel: 'orders.status',
        })
      );
    });

    it('calls onCellFilterAdded with key, value, operator and keyLabel when "Filter out value" is clicked', () => {
      const onCellFilterAdded = jest.fn();
      const field: Field = {
        name: 'status',
        type: FieldType.string,
        values: [],
        config: { displayNameFromDS: 'Status' },
      };

      render(
        <TableCellActions
          field={field}
          value="pending"
          displayName={field.config.displayNameFromDS ?? field.name}
          cellInspect={false}
          showFilters={true}
          setInspectCell={setInspectCell}
          onCellFilterAdded={onCellFilterAdded}
        />
      );

      screen.getByRole('button', { name: 'Filter out value' }).click();

      expect(onCellFilterAdded).toHaveBeenCalledTimes(1);
      expect(onCellFilterAdded).toHaveBeenCalledWith({
        key: 'status',
        operator: FILTER_OUT_OPERATOR,
        value: 'pending',
        keyLabel: 'Status',
      });
    });
  });
});
