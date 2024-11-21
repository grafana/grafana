import { render, fireEvent } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';
import { CustomVariable } from '@grafana/scenes';

import { CustomVariableEditor } from './CustomVariableEditor';

describe('CustomVariableEditor', () => {
  it('should render the CustomVariableForm with correct initial values', () => {
    const variable = new CustomVariable({
      name: 'customVar',
      query: 'test, test2',
      value: 'test',
      isMulti: true,
      includeAll: true,
      allValue: 'test',
    });
    const onRunQuery = jest.fn();

    const { getByTestId } = render(<CustomVariableEditor variable={variable} onRunQuery={onRunQuery} />);

    const queryInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput
    ) as HTMLInputElement;
    const allValueInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput
    ) as HTMLInputElement;
    const multiCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch
    ) as HTMLInputElement;
    const includeAllCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch
    ) as HTMLInputElement;

    expect(queryInput.value).toBe('test, test2');
    expect(allValueInput.value).toBe('test');
    expect(multiCheckbox.checked).toBe(true);
    expect(includeAllCheckbox.checked).toBe(true);
  });

  it('should update the variable state when input values change', () => {
    const variable = new CustomVariable({
      name: 'customVar',
      query: 'test, test2',
      value: 'test',
    });
    const onRunQuery = jest.fn();

    const { getByTestId } = render(<CustomVariableEditor variable={variable} onRunQuery={onRunQuery} />);

    const multiCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch
    );
    const includeAllCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch
    );

    const allowCustomValueCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsAllowCustomValueSwitch
    );

    // It include-all-custom input appears after include-all checkbox is checked only
    expect(() =>
      getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput)
    ).toThrow('Unable to find an element');

    fireEvent.click(allowCustomValueCheckbox);

    fireEvent.click(multiCheckbox);

    fireEvent.click(includeAllCheckbox);
    const allValueInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput
    );

    expect(variable.state.isMulti).toBe(true);
    expect(variable.state.includeAll).toBe(true);
    expect(variable.state.allowCustomValue).toBe(false);
    expect(allValueInput).toBeInTheDocument();
  });

  it('should call update query and re-run query when input loses focus', async () => {
    const variable = new CustomVariable({
      name: 'customVar',
      query: 'test, test2',
      value: 'test',
    });
    const onRunQuery = jest.fn();

    const { getByTestId } = render(<CustomVariableEditor variable={variable} onRunQuery={onRunQuery} />);

    const queryInput = getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput);
    fireEvent.change(queryInput, { target: { value: 'test3, test4' } });
    fireEvent.blur(queryInput);

    expect(onRunQuery).toHaveBeenCalled();
    expect(variable.state.query).toBe('test3, test4');
  });

  it('should update the variable state when all-custom-value input loses focus', () => {
    const variable = new CustomVariable({
      name: 'customVar',
      query: 'test, test2',
      value: 'test',
      isMulti: true,
      includeAll: true,
    });
    const onRunQuery = jest.fn();

    const { getByTestId } = render(<CustomVariableEditor variable={variable} onRunQuery={onRunQuery} />);

    const allValueInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput
    ) as HTMLInputElement;

    fireEvent.change(allValueInput, { target: { value: 'new custom all' } });
    fireEvent.blur(allValueInput);

    expect(variable.state.allValue).toBe('new custom all');
  });
});
