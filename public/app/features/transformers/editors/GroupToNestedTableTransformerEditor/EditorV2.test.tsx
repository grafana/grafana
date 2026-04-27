import { render, fireEvent, screen } from '@testing-library/react';

import { FieldMatcherID, ReducerID } from '@grafana/data';
import { FieldType, toDataFrame } from '@grafana/data/dataframe';
import { GroupByOperationID, type GroupToNestedTableTransformerOptionsV2 } from '@grafana/data/internal';

import { GroupToNestedTableTransformerEditorV2 } from './EditorV2';

const input = [
  toDataFrame({
    fields: [
      { name: 'message', type: FieldType.string, values: ['one', 'two'] },
      { name: 'values', type: FieldType.number, values: [1, 2] },
    ],
  }),
];

describe('GroupToNestedTableTransformerEditorV2', () => {
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

    render(<GroupToNestedTableTransformerEditorV2 input={input} options={options} onChange={onChange} />);

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

    render(<GroupToNestedTableTransformerEditorV2 input={input} options={options} onChange={onChange} />);

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

    render(<GroupToNestedTableTransformerEditorV2 input={input} options={options} onChange={jest.fn()} />);

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

    render(<GroupToNestedTableTransformerEditorV2 input={input} options={options} onChange={jest.fn()} />);

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

    render(<GroupToNestedTableTransformerEditorV2 input={input} options={options} onChange={jest.fn()} />);

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

    render(<GroupToNestedTableTransformerEditorV2 input={input} options={options} onChange={onChange} />);

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

    render(<GroupToNestedTableTransformerEditorV2 input={input} options={options} onChange={onChange} />);

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
      <GroupToNestedTableTransformerEditorV2 input={input} options={options} onChange={onChange} />
    );

    const inputs = screen.getAllByPlaceholderText('Enter regular expression');
    expect(inputs[0]).toHaveValue('/foo/');
    expect(inputs[1]).toHaveValue('/bar/');

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove rule' })[0]);

    const updatedOptions = onChange.mock.calls[0][0] as GroupToNestedTableTransformerOptionsV2;

    rerender(<GroupToNestedTableTransformerEditorV2 input={input} options={updatedOptions} onChange={onChange} />);

    const remaining = screen.getAllByPlaceholderText('Enter regular expression');
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toHaveValue('/bar/');
  });
});
