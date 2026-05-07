import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';

import { CustomVariableForm } from './CustomVariableForm';

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  actual.config.featureToggles = { multiPropsVariables: true };
  return actual;
});

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

  describe('JSON values format', () => {
    test('should render the form fields correctly', async () => {
      const { getByTestId, queryByTestId } = render(
        <CustomVariableForm
          query="query"
          valuesFormat="json"
          multi={true}
          allowCustomValue={true}
          includeAll={true}
          allValue="custom value"
          onQueryChange={onQueryChange}
          onMultiChange={onMultiChange}
          onIncludeAllChange={onIncludeAllChange}
          onAllValueChange={onAllValueChange}
          onAllowCustomValueChange={onAllowCustomValueChange}
        />
      );

      await userEvent.click(screen.getByText('JSON'));

      const multiCheckbox = getByTestId(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch
      );
      const allowCustomValueCheckbox = queryByTestId(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsAllowCustomValueSwitch
      );
      const includeAllCheckbox = getByTestId(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch
      );
      const allValueInput = queryByTestId(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput
      );

      expect(multiCheckbox).toBeInTheDocument();
      expect(multiCheckbox).toBeChecked();
      expect(includeAllCheckbox).toBeInTheDocument();
      expect(includeAllCheckbox).toBeChecked();

      expect(allowCustomValueCheckbox).not.toBeInTheDocument();
      expect(allValueInput).not.toBeInTheDocument();
    });

    test('should display validation error', async () => {
      const validationError = new Error('Ooops! Validation error.');

      const { findByText } = render(
        <CustomVariableForm
          query="query"
          valuesFormat="json"
          queryValidationError={validationError}
          multi={false}
          includeAll={false}
          onQueryChange={onQueryChange}
          onMultiChange={onMultiChange}
          onIncludeAllChange={onIncludeAllChange}
          onAllValueChange={onAllValueChange}
          onAllowCustomValueChange={onAllowCustomValueChange}
        />
      );

      await userEvent.click(screen.getByText('JSON'));

      const errorEl = await findByText(validationError.message);
      expect(errorEl).toBeInTheDocument();
    });
  });
});
