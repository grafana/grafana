import { render, fireEvent } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';

import { CustomVariableForm } from './CustomVariableForm';

describe('CustomVariableForm', () => {
  const onQueryChange = jest.fn();
  const onMultiChange = jest.fn();
  const onIncludeAllChange = jest.fn();
  const onAllValueChange = jest.fn();
  const onAllowCustomValueChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the form fields correctly', () => {
    const { getByTestId } = render(
      <CustomVariableForm
        query="query"
        multi={true}
        allValue="custom value"
        includeAll={true}
        allowCustomValue={true}
        onQueryChange={onQueryChange}
        onMultiChange={onMultiChange}
        onIncludeAllChange={onIncludeAllChange}
        onAllValueChange={onAllValueChange}
        onAllowCustomValueChange={onAllowCustomValueChange}
      />
    );

    const queryInput = getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput);
    const multiCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch
    );
    const includeAllCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch
    );
    const allValueInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput
    );

    const allowCustomValueCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsAllowCustomValueSwitch
    );

    expect(queryInput).toBeInTheDocument();
    expect(queryInput).toHaveValue('query');
    expect(multiCheckbox).toBeInTheDocument();
    expect(multiCheckbox).toBeChecked();
    expect(includeAllCheckbox).toBeInTheDocument();
    expect(includeAllCheckbox).toBeChecked();
    expect(allowCustomValueCheckbox).toBeInTheDocument();
    expect(allowCustomValueCheckbox).toBeChecked();
    expect(allValueInput).toBeInTheDocument();
    expect(allValueInput).toHaveValue('custom value');
  });

  it('should call the correct event handlers on input change', () => {
    const { getByTestId } = render(
      <CustomVariableForm
        query=""
        multi={true}
        allValue=""
        includeAll={true}
        allowCustomValue={true}
        onQueryChange={onQueryChange}
        onMultiChange={onMultiChange}
        onIncludeAllChange={onIncludeAllChange}
        onAllValueChange={onAllValueChange}
        onAllowCustomValueChange={onAllowCustomValueChange}
      />
    );

    const queryInput = getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput);
    const multiCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch
    );
    const includeAllCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch
    );
    const allValueInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput
    );
    const allowCustomValueCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsAllowCustomValueSwitch
    );

    fireEvent.click(multiCheckbox);
    fireEvent.click(includeAllCheckbox);
    fireEvent.click(allowCustomValueCheckbox);
    fireEvent.change(queryInput, { currentTarget: { value: 'test query' } });
    fireEvent.change(allValueInput, { currentTarget: { value: 'test value' } });

    expect(onMultiChange).toHaveBeenCalledTimes(1);
    expect(onAllowCustomValueChange).toHaveBeenCalledTimes(1);
    expect(onIncludeAllChange).toHaveBeenCalledTimes(1);
    expect(onQueryChange).not.toHaveBeenCalledTimes(1);
    expect(onAllValueChange).not.toHaveBeenCalledTimes(1);
  });

  it('should call the correct event handlers on input blur', () => {
    const { getByTestId } = render(
      <CustomVariableForm
        query="query value"
        multi={true}
        allValue="custom all value"
        includeAll={true}
        allowCustomValue={true}
        onQueryChange={onQueryChange}
        onMultiChange={onMultiChange}
        onIncludeAllChange={onIncludeAllChange}
        onAllValueChange={onAllValueChange}
        onAllowCustomValueChange={onAllowCustomValueChange}
      />
    );

    const queryInput = getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput);
    const allValueInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput
    );

    fireEvent.blur(queryInput);
    fireEvent.blur(allValueInput);

    expect(onQueryChange).toHaveBeenCalled();
    expect(onAllValueChange).toHaveBeenCalled();
    expect(onMultiChange).not.toHaveBeenCalled();
    expect(onIncludeAllChange).not.toHaveBeenCalled();
  });
});
