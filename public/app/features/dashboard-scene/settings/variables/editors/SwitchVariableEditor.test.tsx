import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';
import { SwitchVariable } from '@grafana/scenes';

import { SwitchVariableEditor } from './SwitchVariableEditor';

describe('SwitchVariableEditor', () => {
  it('should render the form with value pair type selector', () => {
    const variable = new SwitchVariable({
      name: 'test',
      value: 'false',
      enabledValue: 'true',
      disabledValue: 'false',
    });
    render(<SwitchVariableEditor variable={variable} />);

    expect(screen.getByText('Switch options')).toBeInTheDocument();
    expect(screen.getByText('Value pair type')).toBeInTheDocument();
    expect(
      screen.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.valuePairTypeSelect)
    ).toBeInTheDocument();
  });

  it('should show boolean value pair type for true/false values', () => {
    const variable = new SwitchVariable({
      name: 'test',
      value: 'true',
      enabledValue: 'true',
      disabledValue: 'false',
    });
    render(<SwitchVariableEditor variable={variable} />);

    const combobox = screen.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.valuePairTypeSelect
    );
    expect(combobox).toHaveDisplayValue('True / False');
  });

  it('should show number value pair type for 1/0 values', () => {
    const variable = new SwitchVariable({
      name: 'test',
      value: '1',
      enabledValue: '1',
      disabledValue: '0',
    });
    render(<SwitchVariableEditor variable={variable} />);

    const combobox = screen.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.valuePairTypeSelect
    );
    expect(combobox).toHaveDisplayValue('1 / 0');
  });

  it('should show string value pair type for yes/no values', () => {
    const variable = new SwitchVariable({
      name: 'test',
      value: 'yes',
      enabledValue: 'yes',
      disabledValue: 'no',
    });
    render(<SwitchVariableEditor variable={variable} />);

    const combobox = screen.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.valuePairTypeSelect
    );
    expect(combobox).toHaveDisplayValue('Yes / No');
  });

  it('should show custom value pair type and inputs for custom values', () => {
    const variable = new SwitchVariable({
      name: 'test',
      value: 'on',
      enabledValue: 'on',
      disabledValue: 'off',
    });
    render(<SwitchVariableEditor variable={variable} />);

    const combobox = screen.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.valuePairTypeSelect
    );
    expect(combobox).toHaveDisplayValue('Custom');

    expect(
      screen.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.enabledValueInput)
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.disabledValueInput)
    ).toBeInTheDocument();
  });

  it('should update enabled value and current value when currently enabled', async () => {
    const variable = new SwitchVariable({
      name: 'test',
      value: 'on',
      enabledValue: 'on',
      disabledValue: 'off',
    });
    const user = userEvent.setup();

    render(<SwitchVariableEditor variable={variable} />);

    const enabledInput = screen.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.enabledValueInput
    );
    await user.clear(enabledInput);
    await user.type(enabledInput, 'active');

    expect(variable.state.enabledValue).toBe('active');
    expect(variable.state.value).toBe('active');
  });

  it('should update disabled value and current value when currently disabled', async () => {
    const variable = new SwitchVariable({
      name: 'test',
      value: 'off',
      enabledValue: 'on',
      disabledValue: 'off',
    });
    const user = userEvent.setup();

    render(<SwitchVariableEditor variable={variable} />);

    const disabledInput = screen.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.disabledValueInput
    );
    await user.clear(disabledInput);
    await user.type(disabledInput, 'inactive');

    expect(variable.state.disabledValue).toBe('inactive');
    expect(variable.state.value).toBe('inactive');
  });

  it('should not update current value when changing non-current state value', async () => {
    const variable = new SwitchVariable({
      name: 'test',
      value: 'on',
      enabledValue: 'on',
      disabledValue: 'off',
    });
    const user = userEvent.setup();

    render(<SwitchVariableEditor variable={variable} />);

    const disabledInput = screen.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.disabledValueInput
    );
    await user.clear(disabledInput);
    await user.type(disabledInput, 'inactive');

    expect(variable.state.disabledValue).toBe('inactive');
    expect(variable.state.value).toBe('on'); // Should remain unchanged
  });
});
