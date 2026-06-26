import { render, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FieldMatcherID, FieldType, ReducerID, toDataFrame } from '@grafana/data';
import {
  GroupByOperationID,
  type GroupToNestedTableTransformerOptions,
  type GroupToNestedTableTransformerOptionsV2,
} from '@grafana/data/internal';
import { mockComboboxRect } from '@grafana/test-utils';

import { GroupToNestedTableTransformerEditor } from '.';

const input = [
  toDataFrame({
    fields: [
      { name: 'message', type: FieldType.string, values: ['one', 'two'] },
      { name: 'values', type: FieldType.number, values: [1, 2] },
    ],
  }),
];

// Combobox measures its popover with getBoundingClientRect, which jsdom stubs to zero.
// Without this the options list renders empty and userEvent can't click an option.
beforeAll(() => {
  mockComboboxRect();
});

describe('GroupToNestedTableTransformerEditor', () => {
  it('new rules added via "Add rule" default keepNestedField to true', () => {
    const onChange = jest.fn();
    const options: GroupToNestedTableTransformerOptionsV2 = {
      rules: [
        {
          matcher: { id: FieldMatcherID.byName, options: 'message' },
          operation: GroupByOperationID.groupBy,
          aggregations: [],
        },
      ],
    };

    render(<GroupToNestedTableTransformerEditor input={input} options={options} onChange={onChange} />);

    fireEvent.click(screen.getByText('Add rule'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const updatedOptions: GroupToNestedTableTransformerOptionsV2 = onChange.mock.calls[0][0];
    const newRule = updatedOptions.rules[updatedOptions.rules.length - 1];
    expect(newRule.keepNestedField).toBe(true);
  });

  it('removes the correct rule when its delete button is clicked', () => {
    const onChange = jest.fn();
    const options: GroupToNestedTableTransformerOptionsV2 = {
      rules: [
        {
          matcher: { id: FieldMatcherID.byName, options: 'message' },
          operation: GroupByOperationID.groupBy,
          aggregations: [],
        },
        {
          matcher: { id: FieldMatcherID.byName, options: 'values' },
          operation: GroupByOperationID.aggregate,
          aggregations: [ReducerID.sum],
        },
      ],
    };

    render(<GroupToNestedTableTransformerEditor input={input} options={options} onChange={onChange} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove rule' })[0]);

    expect(onChange).toHaveBeenCalledTimes(1);
    const updatedOptions: GroupToNestedTableTransformerOptionsV2 = onChange.mock.calls[0][0];
    expect(updatedOptions.rules).toHaveLength(1);
    expect(updatedOptions.rules[0].matcher.options).toBe('values');
  });

  it('renders a byName rule with a field-name combobox in the matcher sub-options', () => {
    const options: GroupToNestedTableTransformerOptionsV2 = {
      rules: [
        {
          matcher: { id: FieldMatcherID.byName, options: 'message' },
          operation: GroupByOperationID.groupBy,
          aggregations: [],
        },
      ],
    };

    render(<GroupToNestedTableTransformerEditor input={input} options={options} onChange={jest.fn()} />);

    // FieldNameMatcherEditor renders a Combobox with placeholder "Choose" for field selection
    expect(screen.getByPlaceholderText('Choose')).toBeInTheDocument();
  });

  it('renders a byRegexp rule with a regex text input in the matcher sub-options', () => {
    const options: GroupToNestedTableTransformerOptionsV2 = {
      rules: [
        {
          matcher: { id: FieldMatcherID.byRegexp, options: '/message/' },
          operation: GroupByOperationID.groupBy,
          aggregations: [],
        },
      ],
    };

    render(<GroupToNestedTableTransformerEditor input={input} options={options} onChange={jest.fn()} />);

    // FieldNameByRegexMatcherEditor renders an Input with placeholder "Enter regular expression"
    expect(screen.getByPlaceholderText('Enter regular expression')).toBeInTheDocument();
  });

  it('renders a byType rule with a field-type combobox in the matcher sub-options', () => {
    const options: GroupToNestedTableTransformerOptionsV2 = {
      rules: [
        {
          matcher: { id: FieldMatcherID.byType, options: FieldType.string },
          operation: GroupByOperationID.groupBy,
          aggregations: [],
        },
      ],
    };

    render(<GroupToNestedTableTransformerEditor input={input} options={options} onChange={jest.fn()} />);

    // Three comboboxes total: matcher type, field-type picker, and operation
    expect(screen.getAllByRole('combobox')).toHaveLength(3);
    // No regex input is present (which would indicate a byRegexp matcher instead)
    expect(screen.queryByPlaceholderText('Enter regular expression')).not.toBeInTheDocument();
  });

  it('deletes the correct rule when the first of two identical rules is deleted', () => {
    const onChange = jest.fn();
    const identicalRule = {
      matcher: { id: FieldMatcherID.byName, options: 'message' },
      operation: GroupByOperationID.groupBy,
      aggregations: [],
      keepNestedField: false,
    };
    const options: GroupToNestedTableTransformerOptionsV2 = {
      rules: [identicalRule, { ...identicalRule }],
    };

    render(<GroupToNestedTableTransformerEditor input={input} options={options} onChange={onChange} />);

    const removeButtons = screen.getAllByRole('button', { name: 'Remove rule' });
    expect(removeButtons).toHaveLength(2);
    fireEvent.click(removeButtons[0]);

    expect(onChange).toHaveBeenCalledTimes(1);
    const updatedOptions: GroupToNestedTableTransformerOptionsV2 = onChange.mock.calls[0][0];
    expect(updatedOptions.rules).toHaveLength(1);
  });

  it('edits the correct rule when the first of two identical rules is edited', () => {
    const onChange = jest.fn();
    const identicalRule = {
      matcher: { id: FieldMatcherID.byName, options: 'message' },
      operation: GroupByOperationID.aggregate,
      aggregations: [],
      keepNestedField: true,
    };
    const options: GroupToNestedTableTransformerOptionsV2 = {
      rules: [identicalRule, { ...identicalRule }],
    };

    render(<GroupToNestedTableTransformerEditor input={input} options={options} onChange={onChange} />);

    // Two "Keep nested field(s)" switches (one per rule) plus the "Show field names" switch at the bottom
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);

    expect(onChange).toHaveBeenCalledTimes(1);
    const updatedOptions: GroupToNestedTableTransformerOptionsV2 = onChange.mock.calls[0][0];
    expect(updatedOptions.rules[0].keepNestedField).toBe(false);
    expect(updatedOptions.rules[1].keepNestedField).toBe(true);
  });

  // though similar to the tests above, this is more of a test of whether the `key` is working
  // correctly as opposed to the `onChange` handlers.
  it('keeps the correct regex value displayed after the first of two byRegexp rules is deleted', () => {
    const onChange = jest.fn();
    const options: GroupToNestedTableTransformerOptionsV2 = {
      rules: [
        {
          matcher: { id: FieldMatcherID.byRegexp, options: '/foo/' },
          operation: GroupByOperationID.groupBy,
          aggregations: [],
        },
        {
          matcher: { id: FieldMatcherID.byRegexp, options: '/bar/' },
          operation: GroupByOperationID.groupBy,
          aggregations: [],
        },
      ],
    };

    const { rerender } = render(
      <GroupToNestedTableTransformerEditor input={input} options={options} onChange={onChange} />
    );

    const inputs = screen.getAllByPlaceholderText('Enter regular expression');
    expect(inputs[0]).toHaveValue('/foo/');
    expect(inputs[1]).toHaveValue('/bar/');

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove rule' })[0]);

    const updatedOptions = onChange.mock.calls[0][0] as GroupToNestedTableTransformerOptionsV2;

    rerender(<GroupToNestedTableTransformerEditor input={input} options={updatedOptions} onChange={onChange} />);

    const remaining = screen.getAllByPlaceholderText('Enter regular expression');
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toHaveValue('/bar/');
  });

  describe('Expand nested rows by default', () => {
    it('switch renders unchecked when expandAllRows is undefined', () => {
      const options: GroupToNestedTableTransformerOptionsV2 = {
        rules: [
          {
            matcher: { id: FieldMatcherID.byName, options: 'message' },
            operation: GroupByOperationID.groupBy,
            aggregations: [],
          },
        ],
      };

      render(<GroupToNestedTableTransformerEditor input={input} options={options} onChange={jest.fn()} />);

      const switches = screen.getAllByRole('switch');
      const expandSwitch = switches[switches.length - 1];
      expect(expandSwitch).not.toBeChecked();
    });

    it('calls onChange with expandAllRows: true when toggled from undefined', () => {
      const onChange = jest.fn();
      const options: GroupToNestedTableTransformerOptionsV2 = {
        rules: [
          {
            matcher: { id: FieldMatcherID.byName, options: 'message' },
            operation: GroupByOperationID.groupBy,
            aggregations: [],
          },
        ],
      };

      render(<GroupToNestedTableTransformerEditor input={input} options={options} onChange={onChange} />);

      const switches = screen.getAllByRole('switch');
      fireEvent.click(switches[switches.length - 1]);

      expect(onChange).toHaveBeenCalledTimes(1);
      const updatedOptions: GroupToNestedTableTransformerOptionsV2 = onChange.mock.calls[0][0];
      expect(updatedOptions.expandAllRows).toBe(true);
    });

    it('calls onChange with expandAllRows: false when toggled from true', () => {
      const onChange = jest.fn();
      const options: GroupToNestedTableTransformerOptionsV2 = {
        rules: [
          {
            matcher: { id: FieldMatcherID.byName, options: 'message' },
            operation: GroupByOperationID.groupBy,
            aggregations: [],
          },
        ],
        expandAllRows: true,
      };

      render(<GroupToNestedTableTransformerEditor input={input} options={options} onChange={onChange} />);

      const switches = screen.getAllByRole('switch');
      fireEvent.click(switches[switches.length - 1]);

      expect(onChange).toHaveBeenCalledTimes(1);
      const updatedOptions: GroupToNestedTableTransformerOptionsV2 = onChange.mock.calls[0][0];
      expect(updatedOptions.expandAllRows).toBe(false);
    });
  });

  describe('Show field names in nested tables', () => {
    const groupByOptions: GroupToNestedTableTransformerOptionsV2 = {
      rules: [
        {
          matcher: { id: FieldMatcherID.byName, options: 'message' },
          operation: GroupByOperationID.groupBy,
          aggregations: [],
        },
      ],
    };

    it('switch renders checked when showSubframeHeaders is undefined (defaults to true)', () => {
      render(<GroupToNestedTableTransformerEditor input={input} options={groupByOptions} onChange={jest.fn()} />);

      // With a single groupBy rule there is no per-rule "keep nested field" switch, so the
      // first switch is the "Show field names" one and the last is "Expand nested rows".
      const showFieldNamesSwitch = screen.getAllByRole('switch')[0];
      expect(showFieldNamesSwitch).toBeChecked();
    });

    it('calls onChange with showSubframeHeaders: false when toggled from undefined', () => {
      const onChange = jest.fn();
      render(<GroupToNestedTableTransformerEditor input={input} options={groupByOptions} onChange={onChange} />);

      fireEvent.click(screen.getAllByRole('switch')[0]);

      expect(onChange).toHaveBeenCalledTimes(1);
      const updatedOptions: GroupToNestedTableTransformerOptionsV2 = onChange.mock.calls[0][0];
      expect(updatedOptions.showSubframeHeaders).toBe(false);
    });

    it('calls onChange with showSubframeHeaders: true when toggled from false', () => {
      const onChange = jest.fn();
      const options: GroupToNestedTableTransformerOptionsV2 = { ...groupByOptions, showSubframeHeaders: false };
      render(<GroupToNestedTableTransformerEditor input={input} options={options} onChange={onChange} />);

      const showFieldNamesSwitch = screen.getAllByRole('switch')[0];
      expect(showFieldNamesSwitch).not.toBeChecked();

      fireEvent.click(showFieldNamesSwitch);

      expect(onChange).toHaveBeenCalledTimes(1);
      const updatedOptions: GroupToNestedTableTransformerOptionsV2 = onChange.mock.calls[0][0];
      expect(updatedOptions.showSubframeHeaders).toBe(true);
    });
  });

  describe('Calculations warning', () => {
    const warning = 'Calculations will not have an effect if no fields are being grouped on.';

    it('warns when a calculation rule exists with no grouping rule', () => {
      const options: GroupToNestedTableTransformerOptionsV2 = {
        rules: [
          {
            matcher: { id: FieldMatcherID.byName, options: 'values' },
            operation: GroupByOperationID.aggregate,
            aggregations: [ReducerID.sum],
          },
        ],
      };

      render(<GroupToNestedTableTransformerEditor input={input} options={options} onChange={jest.fn()} />);

      expect(screen.getByText(warning)).toBeInTheDocument();
    });

    it('does not warn when a grouping rule is present alongside the calculation', () => {
      const options: GroupToNestedTableTransformerOptionsV2 = {
        rules: [
          {
            matcher: { id: FieldMatcherID.byName, options: 'message' },
            operation: GroupByOperationID.groupBy,
            aggregations: [],
          },
          {
            matcher: { id: FieldMatcherID.byName, options: 'values' },
            operation: GroupByOperationID.aggregate,
            aggregations: [ReducerID.sum],
          },
        ],
      };

      render(<GroupToNestedTableTransformerEditor input={input} options={options} onChange={jest.fn()} />);

      expect(screen.queryByText(warning)).not.toBeInTheDocument();
    });

    it('does not warn when the calculation rule has no aggregations selected', () => {
      const options: GroupToNestedTableTransformerOptionsV2 = {
        rules: [
          {
            matcher: { id: FieldMatcherID.byName, options: 'values' },
            operation: GroupByOperationID.aggregate,
            aggregations: [],
          },
        ],
      };

      render(<GroupToNestedTableTransformerEditor input={input} options={options} onChange={jest.fn()} />);

      expect(screen.queryByText(warning)).not.toBeInTheDocument();
    });
  });

  describe('Rule editing', () => {
    it('changing the matcher type calls onChange with the new matcher id', async () => {
      const onChange = jest.fn();
      const options: GroupToNestedTableTransformerOptionsV2 = {
        rules: [
          {
            matcher: { id: FieldMatcherID.byName, options: 'message' },
            operation: GroupByOperationID.groupBy,
            aggregations: [],
          },
        ],
      };

      render(<GroupToNestedTableTransformerEditor input={input} options={options} onChange={onChange} />);

      // The matcher-type Combobox shows the current matcher's label as its value.
      await userEvent.click(screen.getByDisplayValue('Fields with name'));
      // The option's accessible name includes the matcher description, so match on a substring.
      await userEvent.click(screen.getByRole('option', { name: /Fields with name matching regex/ }));

      expect(onChange).toHaveBeenCalledTimes(1);
      const updatedOptions: GroupToNestedTableTransformerOptionsV2 = onChange.mock.calls[0][0];
      expect(updatedOptions.rules[0].matcher.id).toBe(FieldMatcherID.byRegexp);
    });

    it('changing the field name in a byName rule calls onChange with the new matcher options', async () => {
      const onChange = jest.fn();
      const options: GroupToNestedTableTransformerOptionsV2 = {
        rules: [
          {
            matcher: { id: FieldMatcherID.byName, options: 'message' },
            operation: GroupByOperationID.groupBy,
            aggregations: [],
          },
        ],
      };

      render(<GroupToNestedTableTransformerEditor input={input} options={options} onChange={onChange} />);

      // The byName matcher sub-options render a field-name Combobox (placeholder "Choose").
      await userEvent.click(screen.getByPlaceholderText('Choose'));
      await userEvent.click(screen.getByRole('option', { name: 'values' }));

      expect(onChange).toHaveBeenCalledTimes(1);
      const updatedOptions: GroupToNestedTableTransformerOptionsV2 = onChange.mock.calls[0][0];
      expect(updatedOptions.rules[0].matcher.options).toBe('values');
    });

    it('selecting "Calculate" calls onChange with the aggregate operation', async () => {
      const onChange = jest.fn();
      const options: GroupToNestedTableTransformerOptionsV2 = {
        rules: [
          {
            matcher: { id: FieldMatcherID.byName, options: 'message' },
            operation: GroupByOperationID.groupBy,
            aggregations: [],
          },
        ],
      };

      render(<GroupToNestedTableTransformerEditor input={input} options={options} onChange={onChange} />);

      // The operation Combobox shows the current operation's label ("Group by") as its value.
      await userEvent.click(screen.getByDisplayValue('Group by'));
      await userEvent.click(screen.getByRole('option', { name: 'Calculate' }));

      expect(onChange).toHaveBeenCalledTimes(1);
      const updatedOptions: GroupToNestedTableTransformerOptionsV2 = onChange.mock.calls[0][0];
      expect(updatedOptions.rules[0].operation).toBe(GroupByOperationID.aggregate);
    });

    it('clearing the operation calls onChange with a null operation', async () => {
      const onChange = jest.fn();
      const options: GroupToNestedTableTransformerOptionsV2 = {
        rules: [
          {
            matcher: { id: FieldMatcherID.byName, options: 'message' },
            operation: GroupByOperationID.groupBy,
            aggregations: [],
          },
        ],
      };

      render(<GroupToNestedTableTransformerEditor input={input} options={options} onChange={onChange} />);

      // The operation Combobox is clearable; its clear control has the title "Clear value".
      await userEvent.click(screen.getByTitle('Clear value'));

      expect(onChange).toHaveBeenCalledTimes(1);
      const updatedOptions: GroupToNestedTableTransformerOptionsV2 = onChange.mock.calls[0][0];
      expect(updatedOptions.rules[0].operation).toBeNull();
    });

    it('falls back to the default matcher UI when the rule has an unknown matcher id', () => {
      const options: GroupToNestedTableTransformerOptionsV2 = {
        rules: [
          {
            // An unknown matcher id should not crash; the editor falls back to the byName matcher UI.
            matcher: { id: 'does-not-exist', options: 'message' },
            operation: GroupByOperationID.groupBy,
            aggregations: [],
          },
        ],
      };

      render(<GroupToNestedTableTransformerEditor input={input} options={options} onChange={jest.fn()} />);

      // The byName fallback renders a field-name Combobox (placeholder "Choose").
      expect(screen.getByPlaceholderText('Choose')).toBeInTheDocument();
    });

    it('selecting a calculation calls onChange with the chosen aggregation', async () => {
      const onChange = jest.fn();
      const options: GroupToNestedTableTransformerOptionsV2 = {
        rules: [
          {
            matcher: { id: FieldMatcherID.byName, options: 'values' },
            operation: GroupByOperationID.aggregate,
            aggregations: [],
          },
        ],
      };

      render(<GroupToNestedTableTransformerEditor input={input} options={options} onChange={onChange} />);

      // The StatsPicker (a MultiCombobox) is the only combobox with this placeholder.
      await userEvent.click(screen.getByPlaceholderText('Select calculation(s)'));
      await userEvent.click(screen.getByRole('option', { name: /Max/ }));

      expect(onChange).toHaveBeenCalledTimes(1);
      const updatedOptions: GroupToNestedTableTransformerOptionsV2 = onChange.mock.calls[0][0];
      expect(updatedOptions.rules[0].aggregations).toContain(ReducerID.max);
    });
  });

  describe('V1 options migration', () => {
    it('migrates legacy field-keyed options into byName rules and renders them', () => {
      const v1Options: GroupToNestedTableTransformerOptions = {
        fields: {
          message: { operation: GroupByOperationID.groupBy, aggregations: [] },
        },
      };

      render(<GroupToNestedTableTransformerEditor input={input} options={v1Options} onChange={jest.fn()} />);

      // The migrated byName rule renders its field-name Combobox with the legacy field name selected.
      expect(screen.getByDisplayValue('message')).toBeInTheDocument();
    });

    it('emits V2 (rules-based) options when a migrated config is edited', () => {
      const onChange = jest.fn();
      const v1Options: GroupToNestedTableTransformerOptions = {
        fields: {
          message: { operation: GroupByOperationID.groupBy, aggregations: [] },
        },
      };

      render(<GroupToNestedTableTransformerEditor input={input} options={v1Options} onChange={onChange} />);

      fireEvent.click(screen.getByText('Add rule'));

      expect(onChange).toHaveBeenCalledTimes(1);
      const updatedOptions = onChange.mock.calls[0][0];
      expect(updatedOptions).toHaveProperty('rules');
      expect(updatedOptions).not.toHaveProperty('fields');
      expect(updatedOptions.rules).toHaveLength(2);
    });
  });
});
