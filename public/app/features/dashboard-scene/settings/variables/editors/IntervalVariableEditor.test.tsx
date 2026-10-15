// unit test for IntervalVariableEditor component

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { JSX } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { IntervalVariable } from '@grafana/scenes';

import { addToEditedDashboard } from '../variableEditTestUtils';

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
      value: '10m',
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
    // If the value is not in the list, it should be set to the first value
    expect(variable.state.value).toBe('7d');
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

describe('IntervalVariableEditor undo/redo', () => {
  const { intervalsValueInput, autoEnabledCheckbox, minIntervalInput } =
    selectors.pages.Dashboard.Settings.Variables.Edit.IntervalVariable;

  function setupInline(state: Partial<IntervalVariable['state']> = {}) {
    const variable = new IntervalVariable({ name: 'interval', intervals: ['1m', '10m'], value: '10m', ...state });
    const sidebar = addToEditedDashboard(variable);
    const result = setup(<IntervalVariableEditor variable={variable} onRunQuery={jest.fn()} inline={true} />);
    return { ...result, variable, sidebar };
  }

  it('records an intervals change made inline as one undoable action', async () => {
    const { user, variable, sidebar } = setupInline();

    await user.clear(screen.getByTestId(intervalsValueInput));
    await user.type(screen.getByTestId(intervalsValueInput), '1h,1d');
    await user.tab();
    expect(variable.state.intervals).toEqual(['1h', '1d']);
    expect(variable.state.value).toBe('1h');
    expect(sidebar.state.undoStack).toHaveLength(1);

    act(() => sidebar.undoAction());
    expect(variable.state.intervals).toEqual(['1m', '10m']);
    expect(variable.state.value).toBe('10m');
    expect(screen.getByTestId(intervalsValueInput)).toHaveValue('1m,10m');

    act(() => sidebar.redoAction());
    expect(variable.state.intervals).toEqual(['1h', '1d']);
    expect(screen.getByTestId(intervalsValueInput)).toHaveValue('1h,1d');
  });

  it('records an auto option change made inline as one undoable action', async () => {
    const { user, variable, sidebar } = setupInline({ autoEnabled: false });

    await user.click(screen.getByTestId(autoEnabledCheckbox));
    expect(variable.state.autoEnabled).toBe(true);
    expect(sidebar.state.undoStack).toHaveLength(1);

    act(() => sidebar.undoAction());
    expect(variable.state.autoEnabled).toBe(false);

    act(() => sidebar.redoAction());
    expect(variable.state.autoEnabled).toBe(true);
  });

  it('records a min interval change made inline as one undoable action', async () => {
    const { user, variable, sidebar } = setupInline({ autoEnabled: true, autoMinInterval: '10s' });

    await user.clear(screen.getByTestId(minIntervalInput));
    await user.type(screen.getByTestId(minIntervalInput), '1m');
    await user.tab();
    expect(variable.state.autoMinInterval).toBe('1m');
    expect(sidebar.state.undoStack).toHaveLength(1);

    act(() => sidebar.undoAction());
    expect(variable.state.autoMinInterval).toBe('10s');
    expect(screen.getByTestId(minIntervalInput)).toHaveValue('10s');

    act(() => sidebar.redoAction());
    expect(variable.state.autoMinInterval).toBe('1m');
  });
});

function setup(jsx: JSX.Element) {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
}
