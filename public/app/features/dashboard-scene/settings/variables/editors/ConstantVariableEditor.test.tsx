import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ConstantVariable } from '@grafana/scenes';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { addToEditedDashboard } from '../variableEditTestUtils';

import { ConstantVariableEditor, getConstantVariableOptions } from './ConstantVariableEditor';

describe('ConstantVariableEditor', () => {
  let constantVar: ConstantVariable;
  beforeEach(async () => {
    const result = await buildTestScene();
    constantVar = result.constantVar;
  });

  it('renders constant value', () => {
    render(<ConstantVariableEditor variable={constantVar} />);
    const input = screen.getByRole('textbox', { name: 'Value' });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('constant value');
  });

  it('changes the value', async () => {
    render(<ConstantVariableEditor variable={constantVar} />);

    const input = screen.getByRole('textbox', { name: 'Value' });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('constant value');

    // change input value
    const newValue = 'new constant value';
    await userEvent.clear(input);
    await userEvent.type(input, newValue);

    expect(input).toHaveValue(newValue);

    await userEvent.tab();
    expect(constantVar.state.value).toBe(newValue);
  });

  it('should get variable options', () => {
    const options = getConstantVariableOptions(constantVar);
    expect(options).toHaveLength(1);
  });

  it('shows the correct value when switching between constants with the same name', async () => {
    const constant1 = new ConstantVariable({
      name: 'env',
      type: 'constant',
      value: 'prod',
      key: 'constant-key-1',
    });
    const constant2 = new ConstantVariable({
      name: 'env',
      type: 'constant',
      value: 'staging',
      key: 'constant-key-2',
    });

    const renderOptionsInput = (variable: ConstantVariable) => {
      const descriptor = getConstantVariableOptions(variable)[0];
      descriptor.parent = new OptionsPaneCategoryDescriptor({
        id: 'mock-parent-id',
        title: 'Mock Parent',
      });
      return render(descriptor.renderElement());
    };

    const { unmount } = renderOptionsInput(constant1);
    expect(screen.getByRole('textbox')).toHaveValue('prod');

    unmount();
    renderOptionsInput(constant2);
    expect(screen.getByRole('textbox')).toHaveValue('staging');

    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'dev');
    await userEvent.tab();

    expect(constant2.state.value).toBe('dev');
    expect(constant1.state.value).toBe('prod');
  });
});

async function buildTestScene() {
  const constantVar = new ConstantVariable({
    name: 'constantVar',
    type: 'constant',
    value: 'constant value',
  });

  return { constantVar };
}

describe('ConstantVariableEditor undo/redo', () => {
  it('records a value change made in the sidebar as one undoable action', async () => {
    const variable = new ConstantVariable({ name: 'constant', value: 'old' });
    const sidebar = addToEditedDashboard(variable);
    const [valueOption] = getConstantVariableOptions(variable);
    valueOption.parent = new OptionsPaneCategoryDescriptor({ id: 'parent', title: 'Parent' });
    render(valueOption.renderElement());

    await userEvent.clear(screen.getByRole('textbox'));
    await userEvent.type(screen.getByRole('textbox'), 'new');
    await userEvent.tab();
    expect(variable.state.value).toBe('new');
    expect(sidebar.state.undoStack).toHaveLength(1);

    act(() => sidebar.undoAction());
    expect(variable.state.value).toBe('old');
    expect(screen.getByRole('textbox')).toHaveValue('old');

    act(() => sidebar.redoAction());
    expect(variable.state.value).toBe('new');
    expect(screen.getByRole('textbox')).toHaveValue('new');
  });
});
