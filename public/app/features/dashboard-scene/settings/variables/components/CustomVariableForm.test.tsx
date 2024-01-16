import { render, fireEvent } from '@testing-library/react';
import React from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { CustomVariableForm } from './CustomVariableForm';

describe('CustomVariableForm', () => {
  const onQueryChange = jest.fn();
  const onMultiChange = jest.fn();
  const onIncludeAllChange = jest.fn();
  const onAllValueChange = jest.fn();
  const onQueryBlur = jest.fn();
  const onAllValueBlur = jest.fn();

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
        onQueryChange={onQueryChange}
        onMultiChange={onMultiChange}
        onIncludeAllChange={onIncludeAllChange}
        onAllValueChange={onAllValueChange}
        onQueryBlur={onQueryBlur}
        onAllValueBlur={onAllValueBlur}
      />
    );

    const queryInput = getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput);
    const multiCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitchV2
    );
    const includeAllCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitchV2
    );
    const allValueInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInputV2
    );

    expect(queryInput).toBeInTheDocument();
    expect(queryInput).toHaveValue('query');
    expect(multiCheckbox).toBeInTheDocument();
    expect(multiCheckbox).toBeChecked();
    expect(includeAllCheckbox).toBeInTheDocument();
    expect(includeAllCheckbox).toBeChecked();
    expect(allValueInput).toBeInTheDocument();
    expect(allValueInput).toHaveValue('custom value');
  });

  it('should call the correct event handlers on input change', () => {
    const { getByTestId } = render(
      <CustomVariableForm
        query=""
        multi={false}
        allValue=""
        includeAll={false}
        onQueryChange={onQueryChange}
        onMultiChange={onMultiChange}
        onIncludeAllChange={onIncludeAllChange}
        onAllValueChange={onAllValueChange}
        onQueryBlur={onQueryBlur}
        onAllValueBlur={onAllValueBlur}
      />
    );

    const queryInput = getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput);
    const multiCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitchV2
    );
    const includeAllCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitchV2
    );

    fireEvent.change(queryInput, { target: { value: 'test query' } });
    fireEvent.change(multiCheckbox, { target: { checked: true } });
    fireEvent.change(includeAllCheckbox, { target: { checked: true } });
    const allValueInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInputV2
    );
    fireEvent.change(allValueInput, { target: { value: 'test value' } });

    expect(onQueryChange).toHaveBeenCalledTimes(1);
    expect(queryInput).toHaveValue('test query');
    expect(onMultiChange).toHaveBeenCalledTimes(1);
    expect(multiCheckbox).toBeChecked();
    expect(onIncludeAllChange).toHaveBeenCalledTimes(1);
    expect(includeAllCheckbox).toBeChecked();
    expect(onAllValueChange).toHaveBeenCalledTimes(1);
    expect(allValueInput).toHaveValue('test value');
    expect(onQueryBlur).not.toHaveBeenCalled();
    expect(onAllValueBlur).not.toHaveBeenCalled();
  });

  it('should call the correct event handlers on input blur', () => {
    const { getByTestId } = render(
      <CustomVariableForm
        query="query value"
        multi={true}
        allValue="custom all value"
        includeAll={true}
        onQueryChange={onQueryChange}
        onMultiChange={onMultiChange}
        onIncludeAllChange={onIncludeAllChange}
        onAllValueChange={onAllValueChange}
        onQueryBlur={onQueryBlur}
        onAllValueBlur={onAllValueBlur}
      />
    );

    const queryInput = getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput);
    const allValueInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInputV2
    );

    fireEvent.blur(queryInput);
    fireEvent.blur(allValueInput);

    expect(onQueryBlur).toHaveBeenCalledTimes(1);
    expect(onAllValueBlur).toHaveBeenCalledTimes(1);
    expect(onQueryChange).not.toHaveBeenCalled();
    expect(onMultiChange).not.toHaveBeenCalled();
    expect(onIncludeAllChange).not.toHaveBeenCalled();
    expect(onAllValueChange).not.toHaveBeenCalled();
  });
});
