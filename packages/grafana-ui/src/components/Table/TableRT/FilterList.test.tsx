import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type SelectableValue } from '@grafana/data';

import { FilterList, REGEX_OPERATOR } from './FilterList';

const XPR_OPERATOR: SelectableValue<string> = { label: 'Expression', value: 'Expression' };

const referenceElement = document.createElement('div');

function numericOptions(values: number[]): SelectableValue[] {
  return values.map((n) => ({ value: String(n), label: String(n) }));
}

function renderFilterList(overrides: Partial<React.ComponentProps<typeof FilterList>> = {}) {
  const defaults: React.ComponentProps<typeof FilterList> = {
    options: [],
    values: [],
    onChange: jest.fn(),
    searchFilter: '',
    setSearchFilter: jest.fn(),
    operator: REGEX_OPERATOR,
    setOperator: jest.fn(),
    referenceElement,
    showOperators: false,
    caseSensitive: false,
  };
  return render(<FilterList {...defaults} {...overrides} />);
}

describe('FilterList (TableRT)', () => {
  describe('CONTAINS / regex operator', () => {
    it('shows all options when search is empty', () => {
      const options: SelectableValue[] = [
        { value: 'apple', label: 'apple' },
        { value: 'banana', label: 'banana' },
        { value: 'cherry', label: 'cherry' },
      ];
      renderFilterList({ options, showOperators: true, searchFilter: '' });
      expect(screen.getByRole('checkbox', { name: 'apple' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'banana' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'cherry' })).toBeInTheDocument();
    });

    it('filters options by label regex match', () => {
      const options: SelectableValue[] = [
        { value: 'apple', label: 'apple' },
        { value: 'apricot', label: 'apricot' },
        { value: 'banana', label: 'banana' },
      ];
      renderFilterList({ options, showOperators: true, searchFilter: 'ap' });
      expect(screen.getByRole('checkbox', { name: 'apple' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'apricot' })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'banana' })).not.toBeInTheDocument();
    });

    it('matches case-insensitively by default', () => {
      const options: SelectableValue[] = [{ value: 'apple', label: 'apple' }];
      renderFilterList({ options, showOperators: true, searchFilter: 'APPLE', caseSensitive: false });
      expect(screen.getByRole('checkbox', { name: 'apple' })).toBeInTheDocument();
    });

    it('respects case when caseSensitive=true', () => {
      const options: SelectableValue[] = [{ value: 'apple', label: 'apple' }];
      renderFilterList({ options, showOperators: true, searchFilter: 'APPLE', caseSensitive: true });
      expect(screen.queryByRole('checkbox', { name: 'apple' })).not.toBeInTheDocument();
    });

    it('shows "No values" when no options match', () => {
      const options: SelectableValue[] = [{ value: 'apple', label: 'apple' }];
      renderFilterList({ options, showOperators: true, searchFilter: 'zzz' });
      expect(screen.getByText('No values')).toBeInTheDocument();
    });

    it('still filters by regex when showOperators is false', () => {
      const options: SelectableValue[] = [
        { value: 'apple', label: 'apple' },
        { value: 'banana', label: 'banana' },
      ];
      renderFilterList({ options, showOperators: false, searchFilter: 'ap' });
      expect(screen.getByRole('checkbox', { name: 'apple' })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'banana' })).not.toBeInTheDocument();
    });
  });

  describe('comparison operators (smoke tests — logic covered in filterExpression.test.ts)', () => {
    it.each([
      ['=', [20]],
      ['!=', [10, 30]],
      ['>', [30]],
      ['>=', [20, 30]],
      ['<', [10]],
      ['<=', [10, 20]],
    ] as Array<[string, number[]]>)('%s shows only matching options', (op, visible) => {
      const all = [10, 20, 30];
      renderFilterList({
        options: numericOptions(all),
        showOperators: true,
        searchFilter: '20',
        operator: { value: op },
      });
      for (const n of all) {
        const el = screen.queryByRole('checkbox', { name: String(n) });
        visible.includes(n) ? expect(el).toBeInTheDocument() : expect(el).not.toBeInTheDocument();
      }
    });

    it('excludes options with undefined value', () => {
      const options: SelectableValue[] = [{ label: 'no-value' }, { value: '20', label: '20' }];
      renderFilterList({ options, showOperators: true, searchFilter: '20', operator: { value: '=' } });
      expect(screen.queryByRole('checkbox', { name: 'no-value' })).not.toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: '20' })).toBeInTheDocument();
    });
  });

  describe('EXPRESSION operator (smoke tests — logic covered in filterExpression.test.ts)', () => {
    it('filters options using a compound && expression', () => {
      renderFilterList({
        options: numericOptions([5, 15, 25]),
        showOperators: true,
        searchFilter: '$ > 10 && $ < 20',
        operator: XPR_OPERATOR,
      });
      expect(screen.queryByRole('checkbox', { name: '5' })).not.toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: '15' })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: '25' })).not.toBeInTheDocument();
    });

    it('shows "No values" for an unparseable expression', () => {
      renderFilterList({
        options: numericOptions([10, 20]),
        showOperators: true,
        searchFilter: '$ ===',
        operator: XPR_OPERATOR,
      });
      expect(screen.getByText('No values')).toBeInTheDocument();
    });

    it('returns false when option.value is undefined', () => {
      const options: SelectableValue[] = [{ label: 'no-value' }];
      renderFilterList({ options, showOperators: true, searchFilter: '$ > 0', operator: XPR_OPERATOR });
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
      renderFilterList({ options, values: [], onChange, searchFilter: '' });

      await user.click(screen.getByRole('checkbox', { name: /Select all/ }));

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
      renderFilterList({ options, values: options, onChange, searchFilter: '' });

      await user.click(screen.getByRole('checkbox', { name: /2 selected/ }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toEqual([]);
    });

    it('preserves hidden selections when deselecting visible items', async () => {
      const user = userEvent.setup();
      const options: SelectableValue[] = [
        { value: 'apple', label: 'apple' },
        { value: 'apricot', label: 'apricot' },
        { value: 'banana', label: 'banana' },
      ];
      const onChange = jest.fn();
      renderFilterList({ options, values: options, onChange, showOperators: true, searchFilter: 'ap' });

      await user.click(screen.getByRole('checkbox', { name: /2 selected/ }));

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
      renderFilterList({ options, values: [], onChange, searchFilter: '' });

      await user.click(screen.getByRole('checkbox', { name: 'Alpha' }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0].map((v: SelectableValue) => v.value)).toContain('a');
    });

    it('removes the item from values when its checkbox is unchecked', async () => {
      const user = userEvent.setup();
      const alphaOption = { value: 'a', label: 'Alpha' };
      const betaOption = { value: 'b', label: 'Beta' };
      const onChange = jest.fn();
      renderFilterList({
        options: [alphaOption, betaOption],
        values: [alphaOption, betaOption],
        onChange,
        searchFilter: '',
      });

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
      renderFilterList({ options, values: [], searchFilter: '' });
      expect(screen.getByRole('checkbox', { name: /Select all/ })).toBeInTheDocument();
    });

    it('shows the selected count when some values are selected', () => {
      const options: SelectableValue[] = [
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'Beta' },
      ];
      renderFilterList({ options, values: [options[0]], searchFilter: '' });
      expect(screen.getByRole('checkbox', { name: /1 selected/ })).toBeInTheDocument();
    });
  });

  describe('operator UI', () => {
    it('renders the filter input when showOperators is true', () => {
      renderFilterList({ showOperators: true, options: [], searchFilter: '' });
      expect(screen.getByPlaceholderText('Filter values')).toBeInTheDocument();
    });

    it('renders the filter input when showOperators is false', () => {
      renderFilterList({ showOperators: false, options: [], searchFilter: '' });
      expect(screen.getByPlaceholderText('Filter values')).toBeInTheDocument();
    });
  });
});
