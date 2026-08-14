import { render, fireEvent } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';

import { QueryVariableRegexForm } from './QueryVariableRegexForm';

describe('QueryVariableRegexForm', () => {
  const onRegExChange = jest.fn();
  const onRegexApplyToChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the form fields correctly', () => {
    const { getByTestId, getByRole } = render(
      <QueryVariableRegexForm
        regex=".*test.*"
        regexApplyTo="value"
        onRegExChange={onRegExChange}
        onRegexApplyToChange={onRegexApplyToChange}
      />
    );

    const regexInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExInputV2
    );
    const regexApplyToField = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExApplyToSelectV2
    );

    expect(regexInput).toBeInTheDocument();
    expect(regexInput).toHaveValue('.*test.*');
    expect(regexApplyToField).toBeInTheDocument();
    expect(getByRole('radio', { name: 'Variable value' })).toBeChecked();
    expect(getByRole('radio', { name: 'Display text' })).not.toBeChecked();
  });

  it('should render with "Display text" option selected', () => {
    const { getByRole } = render(
      <QueryVariableRegexForm
        regex=""
        regexApplyTo="text"
        onRegExChange={onRegExChange}
        onRegexApplyToChange={onRegexApplyToChange}
      />
    );

    expect(getByRole('radio', { name: 'Display text' })).toBeChecked();
    expect(getByRole('radio', { name: 'Variable value' })).not.toBeChecked();
  });

  it('should default to "Variable value" when regexApplyTo is not provided', () => {
    const { getByRole } = render(
      <QueryVariableRegexForm regex="" onRegExChange={onRegExChange} onRegexApplyToChange={onRegexApplyToChange} />
    );

    expect(getByRole('radio', { name: 'Variable value' })).toBeChecked();
  });

  it('should call onRegExChange when regex input is blurred', () => {
    const { getByTestId } = render(
      <QueryVariableRegexForm
        regex=".*"
        regexApplyTo="value"
        onRegExChange={onRegExChange}
        onRegexApplyToChange={onRegexApplyToChange}
      />
    );

    const regexInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExInputV2
    );

    fireEvent.blur(regexInput);

    expect(onRegExChange).toHaveBeenCalledTimes(1);
  });

  it('should call onRegexApplyToChange when radio option is changed', () => {
    const { getByRole } = render(
      <QueryVariableRegexForm
        regex=""
        regexApplyTo="value"
        onRegExChange={onRegExChange}
        onRegexApplyToChange={onRegexApplyToChange}
      />
    );

    const displayTextOption = getByRole('radio', { name: 'Display text' });
    fireEvent.click(displayTextOption);

    expect(onRegexApplyToChange).toHaveBeenCalledTimes(1);
    expect(onRegexApplyToChange).toHaveBeenCalledWith('text');
  });
});
