// unit test for IntervalVariableEditor component

import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { IntervalVariable } from '@grafana/scenes';

import { IntervalVariableEditor } from './IntervalVariableEditor';

describe('IntervalVariableEditor', () => {
  it('should render correctly', () => {
    const variable = new IntervalVariable({
      name: 'test',
      type: 'interval',
      intervals: ['1m', '10m', '1h', '6h', '1d', '7d'],
    });

    const onRunQuery = jest.fn();

    const { getByTestId, queryByTestId } = render(
      <IntervalVariableEditor variable={variable} onRunQuery={onRunQuery} />
    );
    const intervalsInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.IntervalVariable.intervalsValueInput
    );
    const autoEnabledCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.IntervalVariable.autoEnabledCheckbox
    );

    expect(intervalsInput).toBeInTheDocument();
    expect(intervalsInput).toHaveValue('1m,10m,1h,6h,1d,7d');
    expect(autoEnabledCheckbox).toBeInTheDocument();
    expect(autoEnabledCheckbox).not.toBeChecked();
    expect(
      queryByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.IntervalVariable.minIntervalInput)
    ).toBeNull();
    expect(
      queryByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.IntervalVariable.stepCountIntervalSelect)
    ).toBeNull();
  });

  it('should update intervals correctly', async () => {
    const variable = new IntervalVariable({
      name: 'test',
      type: 'interval',
      intervals: ['1m', '10m', '1h', '6h', '1d', '7d'],
    });

    const onRunQuery = jest.fn();

    const { user, getByTestId } = setup(<IntervalVariableEditor variable={variable} onRunQuery={onRunQuery} />);
    const intervalsInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.IntervalVariable.intervalsValueInput
    );

    await user.clear(intervalsInput);
    await user.type(intervalsInput, '7d,30d, 1y, 5y, 10y');
    await user.tab();

    expect(intervalsInput).toBeInTheDocument();
    expect(intervalsInput).toHaveValue('7d,30d, 1y, 5y, 10y');
    expect(onRunQuery).toHaveBeenCalledTimes(1);
  });

  it('should handle auto enabled option correctly', async () => {
    const variable = new IntervalVariable({
      name: 'test',
      type: 'interval',
      intervals: ['1m', '10m', '1h', '6h', '1d', '7d'],
      autoEnabled: false,
    });

    const onRunQuery = jest.fn();

    const { user, getByTestId, queryByTestId } = setup(
      <IntervalVariableEditor variable={variable} onRunQuery={onRunQuery} />
    );

    const autoEnabledCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.IntervalVariable.autoEnabledCheckbox
    );

    await user.click(autoEnabledCheckbox);

    const minIntervalInput = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.IntervalVariable.minIntervalInput
    );

    const stepCountIntervalSelect = queryByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.IntervalVariable.stepCountIntervalSelect
    );

    await waitFor(() => {
      expect(autoEnabledCheckbox).toBeInTheDocument();
      expect(autoEnabledCheckbox).toBeChecked();
      expect(minIntervalInput).toBeInTheDocument();
      expect(stepCountIntervalSelect).toBeInTheDocument();
      expect(minIntervalInput).toHaveValue('10s');
    });

    await user.clear(minIntervalInput);
    await user.type(minIntervalInput, '10m');
    await user.tab();
    expect(minIntervalInput).toHaveValue('10m');
  });
});

function setup(jsx: JSX.Element) {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
}
