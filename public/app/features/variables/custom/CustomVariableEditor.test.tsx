import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CustomVariableModel } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { customBuilder } from '../shared/testing/builders';

import { CustomVariableEditorUnconnected } from './CustomVariableEditor';

const defaultVariable = customBuilder().withId('custom').withRootStateKey('test').withQuery('one,two,three').build();

function setup(overrides: Partial<CustomVariableModel> = {}) {
  const variable = { ...defaultVariable, ...overrides };
  const onPropChange = jest.fn();
  const changeVariableMultiValue = jest.fn();
  const user = userEvent.setup();

  const renderResult = render(
    <CustomVariableEditorUnconnected
      variable={variable}
      onPropChange={onPropChange}
      changeVariableMultiValue={changeVariableMultiValue}
    />
  );

  return { onPropChange, changeVariableMultiValue, variable, ...renderResult, user };
}

describe('CustomVariableEditorUnconnected', () => {
  it('renders the query value', () => {
    const { getByTestId } = setup();

    const queryInput = getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput);

    expect(queryInput).toBeInTheDocument();
    expect(queryInput).toHaveValue('one,two,three');
  });

  it('renders multi with correct checked state', () => {
    const { getByTestId } = setup({ multi: true });

    const multiCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch
    );

    expect(multiCheckbox).toBeChecked();
  });

  it('renders multi with correct unchecked state', () => {
    const { getByTestId } = setup({ multi: false });

    const multiCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch
    );

    expect(multiCheckbox).not.toBeChecked();
  });

  it('renders includeAll with correct checked state', () => {
    const { getByTestId } = setup({ includeAll: true });

    const includeAllChk = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch
    );

    expect(includeAllChk).toBeChecked();
  });

  it('renders includeAll with correct unchecked state', () => {
    const { getByTestId } = setup({ includeAll: false });

    const includeAllChk = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch
    );

    expect(includeAllChk).not.toBeChecked();
  });

  it('renders allValue correct', () => {
    const { getByTestId } = setup({ includeAll: true, allValue: 'Infinity' });

    const allValue = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput
    );

    expect(allValue).toHaveValue('Infinity');
  });

  it('calls onPropChange with query on blur', async () => {
    const { getByTestId, user, onPropChange } = setup();

    const queryInput = getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput);

    await user.click(queryInput);
    await user.tab();

    expect(onPropChange).toHaveBeenCalledWith({ propName: 'query', propValue: 'one,two,three', updateOptions: true });
  });

  it('calls onPropChange with changed query on blur', async () => {
    const { getByTestId, user, onPropChange } = setup();

    const queryInput = getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput);

    await user.clear(queryInput);
    await user.type(queryInput, 'this is an update');
    await user.tab();

    expect(onPropChange).toHaveBeenCalledWith({
      propName: 'query',
      propValue: 'this is an update',
      updateOptions: true,
    });
  });

  it('calls onPropChange with multi on checkbox change', async () => {
    const { getByTestId, user, onPropChange } = setup();

    const multiCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch
    );

    await user.click(multiCheckbox);

    expect(onPropChange).toHaveBeenCalledWith({ propName: 'multi', propValue: true, updateOptions: true });
  });

  it('calls onPropChange with includeAll on checkbox change', async () => {
    const { getByTestId, user, onPropChange } = setup();

    const includeAllCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch
    );

    await user.click(includeAllCheckbox);

    expect(onPropChange).toHaveBeenCalledWith({ propName: 'includeAll', propValue: true, updateOptions: true });
  });

  it('calls onPropChange with allValue on blur when includeAll is true', async () => {
    const { getByTestId, user, onPropChange } = setup({ includeAll: true, allValue: 'current' });

    const allValueInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput
    );

    await user.clear(allValueInput);
    await user.type(allValueInput, 'this is an update');
    await user.tab();

    expect(onPropChange).toHaveBeenCalledWith({
      propName: 'allValue',
      propValue: 'this is an update',
      updateOptions: true,
    });
  });
});
