import { render, fireEvent } from '@testing-library/react';
import React from 'react';

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

    const { getByTestId } = render(<CustomVariableEditor variable={variable} />);

    const queryInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput
    ) as HTMLInputElement;
    const allValueInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInputV2
    ) as HTMLInputElement;
    const multiCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitchV2
    ) as HTMLInputElement;
    const includeAllCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitchV2
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

    const { getByTestId } = render(<CustomVariableEditor variable={variable} />);

    const multiCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitchV2
    );
    const includeAllCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitchV2
    );

    // It include-all-custom input appears after include-all checkbox is checked only
    expect(() =>
      getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInputV2)
    ).toThrow('Unable to find an element');

    fireEvent.click(multiCheckbox);

    fireEvent.click(includeAllCheckbox);
    const allValueInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInputV2
    );

    expect(variable.state.isMulti).toBe(true);
    expect(variable.state.includeAll).toBe(true);
    expect(allValueInput).toBeInTheDocument();
  });

  it('should call update query and generate new options when input loses focus', () => {
    const variable = new CustomVariable({
      name: 'customVar',
      query: 'test, test2',
      value: 'test',
    });

    const { getByTestId } = render(<CustomVariableEditor variable={variable} />);

    const queryInput = getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput);
    fireEvent.change(queryInput, { target: { value: 'test3, test4' } });
    fireEvent.blur(queryInput);

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

    const { getByTestId } = render(<CustomVariableEditor variable={variable} />);

    const allValueInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInputV2
    ) as HTMLInputElement;
    fireEvent.change(allValueInput, { target: { value: 'new custom all' } });

    fireEvent.blur(allValueInput);

    expect(variable.state.allValue).toBe(allValueInput.value);
  });
});
