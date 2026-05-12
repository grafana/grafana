import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { FilterOperator } from '../types';

import { FilterList } from './FilterList';
import { operatorSelectableValues } from './utils';

const ops = operatorSelectableValues();

function containsOp(): SelectableValue<FilterOperator> {
  return ops[FilterOperator.CONTAINS];
}

function op(operator: FilterOperator): SelectableValue<FilterOperator> {
  return ops[operator];
}

function numericOptions(values: number[]): SelectableValue[] {
  return values.map((n) => ({ value: String(n), label: String(n) }));
}

describe('FilterList', () => {
  describe('CONTAINS operator', () => {
    it('shows all options when search is empty', () => {
      const options: SelectableValue[] = [
        { value: 'apple', label: 'apple' },
        { value: 'banana', label: 'banana' },
        { value: 'cherry', label: 'cherry' },
      ];
      render(<FilterList options={options} values={[]} onChange={jest.fn()} searchFilter="" operator={containsOp()} />);
      expect(screen.getByRole('checkbox', { name: 'apple' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'banana' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'cherry' })).toBeInTheDocument();
    });

    it('only shows options whose label matches the search string', () => {
      const options: SelectableValue[] = [
        { value: 'apple', label: 'apple' },
        { value: 'apricot', label: 'apricot' },
        { value: 'banana', label: 'banana' },
      ];
      render(
        <FilterList options={options} values={[]} onChange={jest.fn()} searchFilter="ap" operator={containsOp()} />
      );
      expect(screen.getByRole('checkbox', { name: 'apple' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'apricot' })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'banana' })).not.toBeInTheDocument();
    });

    it('matches case-insensitively by default', () => {
      const options: SelectableValue[] = [{ value: 'apple', label: 'apple' }];
      render(
        <FilterList options={options} values={[]} onChange={jest.fn()} searchFilter="APPLE" operator={containsOp()} />
      );
      expect(screen.getByRole('checkbox', { name: 'apple' })).toBeInTheDocument();
    });

    it('respects case when caseSensitive=true', () => {
      const options: SelectableValue[] = [{ value: 'apple', label: 'apple' }];
      render(
        <FilterList
          options={options}
          values={[]}
          onChange={jest.fn()}
          searchFilter="APPLE"
          operator={containsOp()}
          caseSensitive
        />
      );
      expect(screen.queryByRole('checkbox', { name: 'apple' })).not.toBeInTheDocument();
    });

    it('shows "No values" label when no options match the search', () => {
      const options: SelectableValue[] = [{ value: 'apple', label: 'apple' }];
      render(
        <FilterList options={options} values={[]} onChange={jest.fn()} searchFilter="zzz" operator={containsOp()} />
      );
      expect(screen.getByText('No values')).toBeInTheDocument();
    });
  });

  describe('numeric comparison operators', () => {
    it('EQUALS shows only the item with the matching numeric value', () => {
      const options = numericOptions([10, 20, 30]);
      render(
        <FilterList
          options={options}
          values={[]}
          onChange={jest.fn()}
          searchFilter="20"
          operator={op(FilterOperator.EQUALS)}
        />
      );
      expect(screen.queryByRole('checkbox', { name: '10' })).not.toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: '20' })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: '30' })).not.toBeInTheDocument();
    });

    it('NOT_EQUALS excludes the item with the matching value', () => {
      const options = numericOptions([10, 20, 30]);
      render(
        <FilterList
          options={options}
          values={[]}
          onChange={jest.fn()}
          searchFilter="20"
          operator={op(FilterOperator.NOT_EQUALS)}
        />
      );
      expect(screen.getByRole('checkbox', { name: '10' })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: '20' })).not.toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: '30' })).toBeInTheDocument();
    });

    it('GREATER shows only values strictly greater than the threshold', () => {
      const options = numericOptions([10, 20, 30]);
      render(
        <FilterList
          options={options}
          values={[]}
          onChange={jest.fn()}
          searchFilter="20"
          operator={op(FilterOperator.GREATER)}
        />
      );
      expect(screen.queryByRole('checkbox', { name: '10' })).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: '20' })).not.toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: '30' })).toBeInTheDocument();
    });

    it('GREATER_OR_EQUAL shows values >= the threshold', () => {
      const options = numericOptions([10, 20, 30]);
      render(
        <FilterList
          options={options}
          values={[]}
          onChange={jest.fn()}
          searchFilter="20"
          operator={op(FilterOperator.GREATER_OR_EQUAL)}
        />
      );
      expect(screen.queryByRole('checkbox', { name: '10' })).not.toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: '20' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: '30' })).toBeInTheDocument();
    });

    it('LESS shows only values strictly less than the threshold', () => {
      const options = numericOptions([10, 20, 30]);
      render(
        <FilterList
          options={options}
          values={[]}
          onChange={jest.fn()}
          searchFilter="20"
          operator={op(FilterOperator.LESS)}
        />
      );
      expect(screen.getByRole('checkbox', { name: '10' })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: '20' })).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: '30' })).not.toBeInTheDocument();
    });

    it('LESS_OR_EQUAL shows values <= the threshold', () => {
      const options = numericOptions([10, 20, 30]);
      render(
        <FilterList
          options={options}
          values={[]}
          onChange={jest.fn()}
          searchFilter="20"
          operator={op(FilterOperator.LESS_OR_EQUAL)}
        />
      );
      expect(screen.getByRole('checkbox', { name: '10' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: '20' })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: '30' })).not.toBeInTheDocument();
    });
  });

  describe('EXPRESSION operator', () => {
    it('evaluates a JS expression where $ is the column value', () => {
      const options = numericOptions([5, 15, 25]);
      render(
        <FilterList
          options={options}
          values={[]}
          onChange={jest.fn()}
          searchFilter="$ > 10 && $ < 20"
          operator={op(FilterOperator.EXPRESSION)}
        />
      );
      expect(screen.queryByRole('checkbox', { name: '5' })).not.toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: '15' })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: '25' })).not.toBeInTheDocument();
    });

    it('shows "No values" when the expression throws a syntax error', () => {
      const options = numericOptions([10, 20]);
      // "$ ===" is a valid regex (won't throw new RegExp) but an invalid JS expression
      // ("return $ ===;" throws SyntaxError in the Function constructor).
      render(
        <FilterList
          options={options}
          values={[]}
          onChange={jest.fn()}
          searchFilter="$ ==="
          operator={op(FilterOperator.EXPRESSION)}
        />
      );
      expect(screen.getByText('No values')).toBeInTheDocument();
    });
  });

  describe('select all / deselect all', () => {
    it('calls onChange with all visible items when none are selected', async () => {
      const user = userEvent.setup();
      const options: SelectableValue[] = [
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'Beta' },
      ];
      const onChange = jest.fn();
      render(<FilterList options={options} values={[]} onChange={onChange} searchFilter="" operator={containsOp()} />);

      const selectAll = screen.getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.SelectAll);
      await user.click(selectAll.querySelector('input')!);

      expect(onChange).toHaveBeenCalledTimes(1);
      const newValues: SelectableValue[] = onChange.mock.calls[0][0];
      expect(newValues.map((v) => v.value)).toEqual(expect.arrayContaining(['a', 'b']));
    });

    it('calls onChange removing all visible items when all are already selected', async () => {
      const user = userEvent.setup();
      const options: SelectableValue[] = [
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'Beta' },
      ];
      const onChange = jest.fn();
      render(
        <FilterList options={options} values={options} onChange={onChange} searchFilter="" operator={containsOp()} />
      );

      const selectAll = screen.getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.SelectAll);
      await user.click(selectAll.querySelector('input')!);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toEqual([]);
    });

    it('only removes the currently visible items when deselecting, preserving hidden selections', async () => {
      const user = userEvent.setup();
      const options: SelectableValue[] = [
        { value: 'apple', label: 'apple' },
        { value: 'apricot', label: 'apricot' },
        { value: 'banana', label: 'banana' },
      ];
      const onChange = jest.fn();
      // All three are selected, but search filters to only "ap*" items
      render(
        <FilterList options={options} values={options} onChange={onChange} searchFilter="ap" operator={containsOp()} />
      );

      const selectAll = screen.getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.SelectAll);
      await user.click(selectAll.querySelector('input')!);

      // banana should be preserved because it was not visible
      const remaining: SelectableValue[] = onChange.mock.calls[0][0];
      expect(remaining.map((v) => v.value)).toEqual(['banana']);
    });
  });

  describe('individual item selection', () => {
    it('adds the item to values when its checkbox is checked', async () => {
      const user = userEvent.setup();
      const options: SelectableValue[] = [
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'Beta' },
      ];
      const onChange = jest.fn();
      render(<FilterList options={options} values={[]} onChange={onChange} searchFilter="" operator={containsOp()} />);

      await user.click(screen.getByRole('checkbox', { name: 'Alpha' }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0].map((v: SelectableValue) => v.value)).toContain('a');
    });

    it('removes the item from values when its checkbox is unchecked', async () => {
      const user = userEvent.setup();
      const alphaOption = { value: 'a', label: 'Alpha' };
      const betaOption = { value: 'b', label: 'Beta' };
      const onChange = jest.fn();
      render(
        <FilterList
          options={[alphaOption, betaOption]}
          values={[alphaOption, betaOption]}
          onChange={onChange}
          searchFilter=""
          operator={containsOp()}
        />
      );

      await user.click(screen.getByRole('checkbox', { name: 'Alpha' }));

      expect(onChange).toHaveBeenCalledTimes(1);
      const newValues: SelectableValue[] = onChange.mock.calls[0][0];
      expect(newValues.map((v) => v.value)).not.toContain('a');
      expect(newValues.map((v) => v.value)).toContain('b');
    });
  });

  describe('"Select all" checkbox label', () => {
    it('shows "Select all" when no values are selected', () => {
      const options: SelectableValue[] = [{ value: 'a', label: 'Alpha' }];
      render(<FilterList options={options} values={[]} onChange={jest.fn()} searchFilter="" operator={containsOp()} />);
      expect(screen.getByRole('checkbox', { name: /Select all/ })).toBeInTheDocument();
    });

    it('shows the selected count when some values are selected', () => {
      const options: SelectableValue[] = [
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'Beta' },
      ];
      render(
        <FilterList
          options={options}
          values={[options[0]]}
          onChange={jest.fn()}
          searchFilter=""
          operator={containsOp()}
        />
      );
      expect(screen.getByRole('checkbox', { name: /1 selected/ })).toBeInTheDocument();
    });
  });
});
