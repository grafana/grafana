import { render, fireEvent, screen } from '@testing-library/react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { type DataFrame, FieldType, ValueMatcherID, valueMatchers } from '@grafana/data';
import {
  FilterByValueMatch,
  FilterByValueType,
  filterByValueTransformer,
  type FilterByValueTransformerOptions,
} from '@grafana/data/internal';

import { FilterByValueTransformerEditor } from './FilterByValueTransformerEditor';

describe('FilterByValueTransformerEditor', () => {
  it('filters the newly selected field instead of the saved raw field identity', async () => {
    const onChange = jest.fn<void, [FilterByValueTransformerOptions]>();
    const input: DataFrame[] = [
      {
        fields: [
          { name: 'A', type: FieldType.number, config: {}, values: [null, 1] },
          { name: 'B', type: FieldType.number, config: {}, values: [2, null] },
        ],
        length: 2,
      },
    ];
    const options: FilterByValueTransformerOptions = {
      type: FilterByValueType.include,
      match: FilterByValueMatch.all,
      filters: [{ fieldName: 'A', field: { name: 'A' }, config: { id: ValueMatcherID.isNull, options: {} } }],
    };
    render(<FilterByValueTransformerEditor input={input} options={options} onChange={onChange} />);

    await selectOptionInTest(screen.getByRole('combobox', { name: 'Field' }), 'B');

    expect(onChange).toHaveBeenLastCalledWith({
      ...options,
      filters: [{ fieldName: 'B', field: undefined, config: { id: ValueMatcherID.isNull, options: {} } }],
    });
    const [updatedOptions] = onChange.mock.calls[0];
    const [output] = filterByValueTransformer.transformer(updatedOptions, { interpolate: (s) => s })(input);
    expect(output.fields.map((field) => field.values)).toEqual([[1], [null]]);
  });

  it('correctly applies the default isNull option when onAddFilter is first called', () => {
    // Mock onChange function
    const onChangeMock = jest.fn();

    // Mock options
    const options = {
      type: FilterByValueType.include,
      match: FilterByValueMatch.all,
      filters: [],
    };

    // Mock input
    const input: DataFrame[] = [
      {
        fields: [
          {
            name: 'person',
            type: FieldType.string,
            config: { displayName: 'Person' },
            values: ['john', 'jill', 'jeremy', ''],
          },
          {
            name: 'city',
            type: FieldType.string,
            config: { displayName: 'City' },
            values: ['london', 'budapest', '', 'lisbon'],
          },
        ],
        length: 4,
      },
    ];

    // Render the component
    const { getByText } = render(
      <FilterByValueTransformerEditor input={input} options={options} onChange={onChangeMock} />
    );

    // Find and click the "Add condition" button
    fireEvent.click(getByText('Add condition'));

    // Check if onChange was called with the correct filter
    expect(onChangeMock).toHaveBeenCalledWith({
      filters: [
        {
          fieldName: 'Person',
          config: {
            id: ValueMatcherID.isNull,
            options: valueMatchers.get(ValueMatcherID.isNull).getDefaultOptions({
              name: 'person',
              type: FieldType.string,
              config: { displayName: 'Person' },
              values: ['john', 'jill', 'jeremy', ''],
            }),
          },
        },
      ],
      match: FilterByValueMatch.all,
      type: FilterByValueType.include,
    });
  });
});
it('hides conditions field when there is 0 or 1 filter', () => {
  const onChangeMock = jest.fn();
  const input: DataFrame[] = [
    {
      fields: [{ name: 'field1', type: FieldType.string, config: {}, values: [] }],
      length: 0,
    },
  ];

  // Test with 0 filters
  const { queryByText, rerender } = render(
    <FilterByValueTransformerEditor
      input={input}
      options={{ type: FilterByValueType.include, match: FilterByValueMatch.all, filters: [] }}
      onChange={onChangeMock}
    />
  );
  expect(queryByText('Conditions')).not.toBeInTheDocument();

  // Test with 1 filter
  rerender(
    <FilterByValueTransformerEditor
      input={input}
      options={{
        type: FilterByValueType.include,
        match: FilterByValueMatch.all,
        filters: [{ fieldName: 'test', config: { id: ValueMatcherID.isNull, options: {} } }],
      }}
      onChange={onChangeMock}
    />
  );
  expect(queryByText('Conditions')).not.toBeInTheDocument();
});

it('shows conditions field when there are more than 1 filter', () => {
  const onChangeMock = jest.fn();
  const input: DataFrame[] = [
    {
      fields: [{ name: 'field1', type: FieldType.string, config: {}, values: [] }],
      length: 0,
    },
  ];

  const { getByText } = render(
    <FilterByValueTransformerEditor
      input={input}
      options={{
        type: FilterByValueType.include,
        match: FilterByValueMatch.all,
        filters: [
          { fieldName: 'test1', config: { id: ValueMatcherID.isNull, options: {} } },
          { fieldName: 'test2', config: { id: ValueMatcherID.isNull, options: {} } },
        ],
      }}
      onChange={onChangeMock}
    />
  );
  expect(getByText('Conditions')).toBeInTheDocument();
});
