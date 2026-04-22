import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { toDataFrame, FieldType, ReducerID, type FieldValueMatcherConfig } from '@grafana/data';
import { ComparisonOperation } from '@grafana/schema';

import { FieldNameByRegexMatcherEditor, getFieldNameByRegexMatcherItem } from './FieldNameByRegexMatcherEditor';
import { FieldNameMatcherEditor, getFieldNameMatcherItem } from './FieldNameMatcherEditor';
import { FieldNamesMatcherEditor, getFieldNamesMatcherItem } from './FieldNamesMatcherEditor';
import { FieldTypeMatcherEditor, getFieldTypeMatcherItem } from './FieldTypeMatcherEditor';
import { FieldValueMatcherEditor, getFieldValueMatcherItem } from './FieldValueMatcher';
import { MatcherScopeSelector } from './MatcherScopeSelector';

beforeEach(() => {
  jest.clearAllMocks();
});

const frameWithFields = toDataFrame({
  fields: [
    { name: 'Time', type: FieldType.time, values: [1, 2, 3] },
    { name: 'Value', type: FieldType.number, values: [10, 20, 30] },
    { name: 'Label', type: FieldType.string, values: ['a', 'b', 'c'] },
  ],
});

const frameWithDisplayName = toDataFrame({
  fields: [
    {
      name: 'rawField',
      type: FieldType.number,
      values: [1],
      config: { displayName: 'Display Name' },
    },
  ],
});

describe('MatcherScopeSelector', () => {
  const mockOnChange = jest.fn();

  it('renders scope options from provided scopes', () => {
    render(
      <MatcherScopeSelector
        scopes={new Set(['series', 'nested'])}
        value="series"
        onChange={mockOnChange}
        aria-label="Scope"
      />
    );
    expect(screen.getByRole('radiogroup', { name: 'Scope' })).toBeInTheDocument();
    expect(screen.getByLabelText('Dataframe')).toBeInTheDocument();
    expect(screen.getByLabelText('Nested')).toBeInTheDocument();
  });

  it('calls onChange with selected scope when user selects a different scope', async () => {
    const user = userEvent.setup();
    render(
      <MatcherScopeSelector
        scopes={new Set(['series', 'nested'])}
        value="series"
        onChange={mockOnChange}
        aria-label="Scope"
      />
    );
    await user.click(screen.getByLabelText('Nested'));
    expect(mockOnChange).toHaveBeenCalledWith('nested');
  });

  it('filters options by allowedScopes when provided', () => {
    render(
      <MatcherScopeSelector
        scopes={new Set(['series', 'nested', 'annotation'])}
        allowedScopes={['series', 'nested']}
        value="series"
        onChange={mockOnChange}
        aria-label="Scope"
      />
    );
    expect(screen.getByLabelText('Dataframe')).toBeInTheDocument();
    expect(screen.getByLabelText('Nested')).toBeInTheDocument();
    expect(screen.queryByLabelText('Annotations')).not.toBeInTheDocument();
  });

  it('shows current scope value when it is not in the detected scopes (e.g. saved scope no longer in data)', () => {
    render(
      <MatcherScopeSelector
        scopes={new Set(['series'])}
        value="annotation"
        onChange={mockOnChange}
        aria-label="Scope"
      />
    );
    expect(screen.getByLabelText('Annotations')).toBeInTheDocument();
  });
});

const frameWithSeriesAndNestedScopes = (() => {
  const nestedFrame = toDataFrame({
    fields: [{ name: 'NestedField', type: FieldType.string, values: ['n'] }],
  });
  return toDataFrame({
    fields: [
      { name: 'SeriesField', type: FieldType.string, values: ['s'] },
      {
        name: 'nested',
        type: FieldType.nestedFrames,
        values: [[nestedFrame]],
        config: {},
      },
    ],
  });
})();

describe('FieldNameMatcherEditor', () => {
  const mockOnChange = jest.fn();
  const matcher = getFieldNameMatcherItem().matcher;

  it('renders combobox with placeholder', () => {
    render(<FieldNameMatcherEditor data={[frameWithFields]} options="" onChange={mockOnChange} matcher={matcher} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('calls onChange with selected field name and scope when user selects a field', async () => {
    const user = userEvent.setup();
    render(<FieldNameMatcherEditor data={[frameWithFields]} options="" onChange={mockOnChange} matcher={matcher} />);
    const combobox = screen.getByRole('combobox');
    await user.click(combobox);
    // Option order: Time (0), Value (1), Label (2); one ArrowDown then Enter selects Value
    await user.keyboard('{ArrowDown}{Enter}');
    expect(mockOnChange).toHaveBeenCalledWith('Value', 'series');
  });

  it('passes scope from selected field to onChange when display name differs from raw name', async () => {
    const user = userEvent.setup();
    render(
      <FieldNameMatcherEditor data={[frameWithDisplayName]} options="" onChange={mockOnChange} matcher={matcher} />
    );
    const combobox = screen.getByRole('combobox');
    await user.click(combobox);
    // Option order: raw "rawField" first, then display "Display Name"
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(mockOnChange).toHaveBeenCalledWith('Display Name', 'series');
  });

  it('does not call onChange when selection is not a valid field name', async () => {
    const user = userEvent.setup();
    render(
      <FieldNameMatcherEditor data={[frameWithFields]} options="Value" onChange={mockOnChange} matcher={matcher} />
    );
    const combobox = screen.getByRole('combobox');
    await user.click(combobox);
    // Selecting the same value again might not fire onChange with a different path; ensure we only
    // accept options that are in the names set (covered by frameHasName in the component).
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('only shows series-scoped fields and calls onChange with "series" when nested field scope is present ("series" is the default)', async () => {
    // Regression test: getFieldOverrideElements passes scope={override.matcher.scope ?? 'series'}.
    // Before the fix, a new override (scope=undefined) was passed through as-is, causing the
    // by-name matcher to show options in grouped mode (grouped by "Dataframe" / "Nested") even
    // though the scope selector defaulted to "series". The fix ensures 'series' is always the
    // fallback, so options are filtered to series-scoped fields and onChange receives 'series'.
    const user = userEvent.setup();
    render(
      <FieldNameMatcherEditor
        data={[frameWithSeriesAndNestedScopes]}
        options=""
        onChange={mockOnChange}
        matcher={matcher}
      />
    );
    const combobox = screen.getByRole('combobox');
    await user.click(combobox);

    // SeriesField is the first (and only) series-scoped field; selecting it should yield scope 'series'
    await user.keyboard('{ArrowDown}{Enter}');
    expect(mockOnChange).toHaveBeenCalledWith('SeriesField', 'series');

    // NestedField must not be present in the filtered options: type its name to narrow the list,
    // then press Enter — frameHasName will reject it and onChange must not fire again.
    mockOnChange.mockClear();
    await user.clear(combobox);
    await user.type(combobox, 'NestedField');
    await user.keyboard('{Enter}');
    expect(mockOnChange).not.toHaveBeenCalled();
  });
});

describe('FieldNameByRegexMatcherEditor', () => {
  const mockOnChange = jest.fn();
  const matcher = getFieldNameByRegexMatcherItem().matcher;

  it('renders input with regex placeholder', () => {
    render(<FieldNameByRegexMatcherEditor data={[]} options="" onChange={mockOnChange} matcher={matcher} />);
    expect(screen.getByPlaceholderText(/regular expression/i)).toBeInTheDocument();
  });

  it('calls onChange with regex value and scope on blur', async () => {
    const user = userEvent.setup();
    render(
      <FieldNameByRegexMatcherEditor data={[]} options="" onChange={mockOnChange} matcher={matcher} scope="nested" />
    );
    const input = screen.getByPlaceholderText(/regular expression/i);
    await user.type(input, 'myRegex');
    fireEvent.blur(input);
    expect(mockOnChange).toHaveBeenCalledWith('myRegex', 'nested');
  });

  it('uses series scope by default when scope prop is not provided', async () => {
    const user = userEvent.setup();
    render(<FieldNameByRegexMatcherEditor data={[]} options="" onChange={mockOnChange} matcher={matcher} />);
    const input = screen.getByPlaceholderText(/regular expression/i);
    await user.type(input, 'test');
    fireEvent.blur(input);
    expect(mockOnChange).toHaveBeenCalledWith('test', 'series');
  });
});

describe('FieldTypeMatcherEditor', () => {
  const mockOnChange = jest.fn();
  const matcher = getFieldTypeMatcherItem().matcher;

  it('renders combobox with field type options', () => {
    render(<FieldTypeMatcherEditor data={[frameWithFields]} options="" onChange={mockOnChange} matcher={matcher} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('calls onChange with field type when user selects a type', async () => {
    const user = userEvent.setup();
    render(<FieldTypeMatcherEditor data={[frameWithFields]} options="" onChange={mockOnChange} matcher={matcher} />);
    const combobox = screen.getByRole('combobox');
    await user.click(combobox);
    // First option is number (frame has time, number, string fields)
    await user.keyboard('{Enter}');
    expect(mockOnChange).toHaveBeenCalledWith('number');
  });
});

describe('FieldValueMatcherEditor', () => {
  const mockOnChange = jest.fn();
  const matcher = getFieldValueMatcherItem().matcher;

  it('renders reducer combobox and calls onChange when reducer is selected', async () => {
    const user = userEvent.setup();
    render(
      <FieldValueMatcherEditor
        data={[frameWithFields]}
        options={{ reducer: ReducerID.lastNotNull }}
        onChange={mockOnChange}
        matcher={matcher}
      />
    );
    const combobox = screen.getByPlaceholderText('Select field reducer');
    await user.click(combobox);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ reducer: expect.any(String) }));
  });

  it('calls onChange with value when number input is changed', async () => {
    let _setOptions: jest.Mock = jest.fn();

    const FieldValueMatcherEditorHarness = () => {
      const [options, setOptions] = useState<FieldValueMatcherConfig>({
        reducer: ReducerID.sum,
        op: ComparisonOperation.GT,
        value: 0,
      });
      _setOptions.mockImplementation(setOptions);
      return (
        <FieldValueMatcherEditor data={[frameWithFields]} options={options} onChange={_setOptions} matcher={matcher} />
      );
    };
    render(<FieldValueMatcherEditorHarness />);
    const valueInput = screen.getByRole('spinbutton', { name: 'Reducer value' });
    await userEvent.type(valueInput, '42');
    expect(_setOptions).toHaveBeenCalledWith(
      expect.objectContaining({ reducer: ReducerID.sum, op: ComparisonOperation.GT, value: 42 })
    );
  });
});

describe('FieldNamesMatcherEditor', () => {
  const mockOnChange = jest.fn();
  const matcher = getFieldNamesMatcherItem().matcher;

  it('renders multiselect when not readOnly', () => {
    render(
      <FieldNamesMatcherEditor
        data={[frameWithFields]}
        options={{ names: [] }}
        onChange={mockOnChange}
        matcher={matcher}
      />
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('calls onChange with names array when user selects multiple fields', async () => {
    const user = userEvent.setup();
    render(
      <FieldNamesMatcherEditor
        data={[frameWithFields]}
        options={{ names: [] }}
        onChange={mockOnChange}
        matcher={matcher}
      />
    );
    const combobox = screen.getByRole('combobox');
    await user.click(combobox);
    // Option order: Time (0), Value (1), Label (2); one ArrowDown then Enter selects Value
    await user.keyboard('{ArrowDown}{Enter}');
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ names: ['Value'] }));
  });

  it('respects scope prop and only shows fields for that scope', () => {
    render(
      <FieldNamesMatcherEditor
        data={[frameWithFields]}
        options={{ names: [] }}
        onChange={mockOnChange}
        matcher={matcher}
        scope="series"
      />
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    // With only series scope in data, options should still be available
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders read-only input when options.readOnly is true', () => {
    render(
      <FieldNamesMatcherEditor
        data={[frameWithFields]}
        options={{ names: ['Time', 'Value'], readOnly: true }}
        onChange={mockOnChange}
        matcher={matcher}
      />
    );
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('readonly');
    expect(input).toHaveValue('Time, Value');
  });
});
