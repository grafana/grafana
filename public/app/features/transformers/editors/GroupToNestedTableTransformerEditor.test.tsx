import { render, fireEvent, screen } from '@testing-library/react';

import { FieldMatcherID, FieldType, toDataFrame } from '@grafana/data';
import { GroupByOperationID, type GroupToNestedTableTransformerOptionsV2 } from '@grafana/data/internal';

import { GroupToNestedTableTransformerEditor } from './GroupToNestedTableTransformerEditor';

const input = [
  toDataFrame({
    fields: [
      { name: 'message', type: FieldType.string, values: ['one', 'two'] },
      { name: 'values', type: FieldType.number, values: [1, 2] },
    ],
  }),
];

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
});
