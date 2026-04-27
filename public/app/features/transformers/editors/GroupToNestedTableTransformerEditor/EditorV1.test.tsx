import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { comboboxTestSetup } from 'test/helpers/comboboxTestSetup';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { FieldType, ReducerID, toDataFrame } from '@grafana/data';
import { GroupByOperationID, type GroupToNestedTableTransformerOptions } from '@grafana/data/internal';

import { GroupToNestedTableTransformerEditorV1 } from './EditorV1';

const input = [
  toDataFrame({
    fields: [
      { name: 'message', type: FieldType.string, values: ['one', 'two'] },
      { name: 'values', type: FieldType.number, values: [1, 2] },
    ],
  }),
];

describe('GroupToNestedTableTransformerEditorV1', () => {
  beforeAll(() => {
    // Required for MultiCombobox (StatsPicker) virtual list to render items in JSDOM.
    comboboxTestSetup();
  });

  it('lists all field names from the input frame as labelled rows', () => {
    const options: GroupToNestedTableTransformerOptions = { fields: {} };

    render(<GroupToNestedTableTransformerEditorV1 input={input} options={options} onChange={jest.fn()} />);

    expect(screen.getByText('message')).toBeInTheDocument();
    expect(screen.getByText('values')).toBeInTheDocument();
  });

  it('calls onChange with groupBy when Group by is selected for a field', async () => {
    const onChange = jest.fn();
    const options: GroupToNestedTableTransformerOptions = { fields: {} };

    render(<GroupToNestedTableTransformerEditorV1 input={input} options={options} onChange={onChange} />);

    // Each field row has a Select whose accessible name matches the field label
    await selectOptionInTest(screen.getByRole('combobox', { name: 'message' }), 'Group by');

    expect(onChange).toHaveBeenCalledWith({
      fields: {
        message: { operation: GroupByOperationID.groupBy, aggregations: [] },
      },
    });
  });

  it('calls onChange with aggregate and chosen calculation when Calculate is selected then a stat is picked', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onChange = jest.fn();
    const options: GroupToNestedTableTransformerOptions = { fields: {} };

    const { rerender } = render(
      <GroupToNestedTableTransformerEditorV1 input={input} options={options} onChange={onChange} />
    );

    // Step 1: select "Calculate" — onChange fires with operation set, no stats yet
    await selectOptionInTest(screen.getByRole('combobox', { name: 'values' }), 'Calculate');

    expect(onChange).toHaveBeenCalledWith({
      fields: {
        values: { operation: GroupByOperationID.aggregate, aggregations: [] },
      },
    });

    // Step 2: simulate the parent re-rendering with the updated options so the StatsPicker appears.
    // Also blur the active element: react-select-event leaves focus on the operation select, which
    // would interfere with the MultiCombobox open/close cycle when user.click fires below.
    (document.activeElement as HTMLElement)?.blur();
    rerender(
      <GroupToNestedTableTransformerEditorV1
        input={input}
        options={{ fields: { values: { operation: GroupByOperationID.aggregate, aggregations: [] } } }}
        onChange={onChange}
      />
    );

    // Step 3: open the StatsPicker (MultiCombobox) and pick "Last".
    // ReducerID.last (label "Last") is position 2 in the registry — safely within the virtual window.
    await user.click(screen.getByPlaceholderText('Select stats'));

    await waitFor(() => {
      expect(document.getElementById(`combobox-option-${ReducerID.last}`)).toBeInTheDocument();
    });

    await user.click(document.getElementById(`combobox-option-${ReducerID.last}`)!);

    // Step 4: onChange is called with the chosen calculation included
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith({
        fields: {
          values: { operation: GroupByOperationID.aggregate, aggregations: [ReducerID.last] },
        },
      });
    });
  });
});
