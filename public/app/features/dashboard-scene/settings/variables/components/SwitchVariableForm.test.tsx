import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';

import { SwitchVariableForm } from './SwitchVariableForm';

describe('SwitchVariableForm', () => {
  const onEnabledValueChange = jest.fn();
  const onDisabledValueChange = jest.fn();

  const defaultProps = {
    enabledValue: 'true',
    disabledValue: 'false',
    onEnabledValueChange,
    onDisabledValueChange,
  };

  function renderForm(props = {}) {
    return render(<SwitchVariableForm {...defaultProps} {...props} />);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the form', () => {
    render(<SwitchVariableForm {...defaultProps} />);

    expect(screen.getByText('Switch options')).toBeInTheDocument();
    expect(screen.getByText('Value pair type')).toBeInTheDocument();
    expect(
      screen.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.valuePairTypeSelect)
    ).toBeInTheDocument();
  });

  it('should not show custom inputs for predefined value pair types', () => {
    renderForm();

    expect(
      screen.queryByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.enabledValueInput)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.disabledValueInput)
    ).not.toBeInTheDocument();
  });

  it('should show custom inputs when value pair type is custom', () => {
    renderForm({
      enabledValue: 'on',
      disabledValue: 'off',
    });

    expect(
      screen.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.enabledValueInput)
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.disabledValueInput)
    ).toBeInTheDocument();
  });

  it('should call onEnabledValueChange when enabled value input changes', async () => {
    const user = userEvent.setup();
    renderForm({
      enabledValue: '',
      disabledValue: 'off',
    });

    const enabledInput = screen.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.enabledValueInput
    );
    await user.type(enabledInput, 't');

    expect(onEnabledValueChange).toHaveBeenCalledTimes(1);
    expect(onEnabledValueChange).toHaveBeenNthCalledWith(1, 't');
  });

  it('should call onDisabledValueChange when disabled value input changes', async () => {
    const user = userEvent.setup();
    renderForm({
      enabledValue: 'on',
      disabledValue: '',
    });

    const disabledInput = screen.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.disabledValueInput
    );
    await user.type(disabledInput, 't');

    expect(onDisabledValueChange).toHaveBeenCalledTimes(1);
    expect(onDisabledValueChange).toHaveBeenCalledWith('t');
  });

  it('should handle all predefined value pair types correctly', () => {
    const testCases = [
      { enabled: 'true', disabled: 'false', expected: 'True / False', hasCustomInputs: false },
      { enabled: '1', disabled: '0', expected: '1 / 0', hasCustomInputs: false },
      { enabled: 'yes', disabled: 'no', expected: 'Yes / No', hasCustomInputs: false },
      { enabled: 'custom', disabled: 'value', expected: 'Custom', hasCustomInputs: true },
    ];

    testCases.forEach(({ enabled, disabled, expected, hasCustomInputs }) => {
      const { unmount } = renderForm({
        enabledValue: enabled,
        disabledValue: disabled,
      });

      expect(
        screen.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.valuePairTypeSelect)
      ).toHaveValue(expected);

      if (hasCustomInputs) {
        expect(
          screen.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.enabledValueInput)
        ).toBeInTheDocument();
        expect(
          screen.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.disabledValueInput)
        ).toBeInTheDocument();
      } else {
        expect(
          screen.queryByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.enabledValueInput)
        ).not.toBeInTheDocument();
        expect(
          screen.queryByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.disabledValueInput)
        ).not.toBeInTheDocument();
      }

      unmount();
    });
  });

  it('should show error when enabled value matches disabled value', async () => {
    const user = userEvent.setup();
    renderForm({
      enabledValue: 'on',
      disabledValue: 'off',
    });

    const enabledInput = screen.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.enabledValueInput
    );

    await user.clear(enabledInput);
    await user.type(enabledInput, 'off');

    expect(screen.getByText('Enabled and disabled values cannot be the same')).toBeInTheDocument();
    expect(onEnabledValueChange).not.toHaveBeenCalledWith('off');
  });

  it('should show error when disabled value matches enabled value', async () => {
    const user = userEvent.setup();
    renderForm({
      enabledValue: 'on',
      disabledValue: 'off',
    });

    const disabledInput = screen.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.disabledValueInput
    );

    await user.clear(disabledInput);
    await user.type(disabledInput, 'on');

    expect(screen.getByText('Enabled and disabled values cannot be the same')).toBeInTheDocument();
    expect(onDisabledValueChange).not.toHaveBeenCalledWith('on');
  });

  it('should clear the error when the values are update to not be the same', async () => {
    const user = userEvent.setup();
    renderForm({
      enabledValue: 'on',
      disabledValue: 'off',
    });

    const enabledInput = screen.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.enabledValueInput
    );
    const disabledInput = screen.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.disabledValueInput
    );

    // First make disabled value same as enabled
    await user.clear(disabledInput);
    await user.type(disabledInput, 'on');
    expect(screen.getByText('Enabled and disabled values cannot be the same')).toBeInTheDocument();

    // Then change enabled value to something that is not identical
    await user.clear(enabledInput);
    await user.type(enabledInput, 'new');
    expect(screen.queryByText('Enabled and disabled values cannot be the same')).not.toBeInTheDocument();
  });
});
