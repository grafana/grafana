import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { comboboxTestSetup } from 'test/helpers/comboboxTestSetup';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { FieldMatcherID, FieldType, ReducerID, toDataFrame } from '@grafana/data';
import {
  GroupByOperationID,
  type GroupToNestedTableTransformerOptions,
  type GroupToNestedTableTransformerOptionsV2,
} from '@grafana/data/internal';
import { config } from '@grafana/runtime';

import { GroupToNestedTableTransformerEditor } from './GroupToNestedTableTransformerEditor';

const input = [
  toDataFrame({
    fields: [
      { name: 'message', type: FieldType.string, values: ['one', 'two'] },
      { name: 'values', type: FieldType.number, values: [1, 2] },
    ],
  }),
];

// ---------------------------------------------------------------------------
// V2 editor tests
// ---------------------------------------------------------------------------

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

    // Click the delete button for the first rule
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

    // FieldTypeMatcherEditor renders a Combobox for type selection.
    // Three comboboxes total: matcher type, field-type picker, and operation.
    expect(screen.getAllByRole('combobox')).toHaveLength(3);
    // No regex input is present (which would indicate a byRegexp matcher instead)
    expect(screen.queryByPlaceholderText('Enter regular expression')).not.toBeInTheDocument();
  });

  it('keeps the correct regex value displayed after the first of two byRegexp rules is deleted', () => {
    // Regression: FieldNameByRegexMatcherEditor uses useState(options) — its internal
    // state initialises from props once and never re-syncs. With key={index}, deleting
    // rule[0] causes React to reuse that component instance for rule[1], so the input
    // shows rule[0]'s regex instead of rule[1]'s. getRuleKeys() fixes this by giving
    // each row a key derived from its matcher content, keeping component instances
    // aligned with their rule regardless of deletion.
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

    rerender(
      <GroupToNestedTableTransformerEditor input={input} options={updatedOptions} onChange={onChange} />
    );

    const remaining = screen.getAllByPlaceholderText('Enter regular expression');
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toHaveValue('/bar/');
  });
});

// ---------------------------------------------------------------------------
// V1 editor tests
// ---------------------------------------------------------------------------

describe('GroupToNestedTableTransformerEditor - V1 editor', () => {
  let originalFeatureToggles: typeof config.featureToggles;

  beforeAll(() => {
    // Required for MultiCombobox (StatsPicker) virtual list to render items in JSDOM.
    comboboxTestSetup();
  });

  beforeEach(() => {
    originalFeatureToggles = config.featureToggles;
    // Force V1 editor: the component shows V1 when the toggle is off and options use the V1 shape
    config.featureToggles = { ...originalFeatureToggles, groupToNestedTableV2: false };
  });

  afterEach(() => {
    config.featureToggles = originalFeatureToggles;
  });

  it('lists all field names from the input frame as labelled rows', () => {
    const options: GroupToNestedTableTransformerOptions = { fields: {} };

    render(<GroupToNestedTableTransformerEditor input={input} options={options} onChange={jest.fn()} />);

    expect(screen.getByText('message')).toBeInTheDocument();
    expect(screen.getByText('values')).toBeInTheDocument();
  });

  it('calls onChange with groupBy when Group by is selected for a field', async () => {
    const onChange = jest.fn();
    const options: GroupToNestedTableTransformerOptions = { fields: {} };

    render(<GroupToNestedTableTransformerEditor input={input} options={options} onChange={onChange} />);

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
      <GroupToNestedTableTransformerEditor input={input} options={options} onChange={onChange} />
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
      <GroupToNestedTableTransformerEditor
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
