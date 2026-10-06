import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TextBoxVariable } from '@grafana/scenes';

import { addToEditedDashboard } from '../variableEditTestUtils';

import { TextBoxVariableEditor } from './TextBoxVariableEditor';

describe('TextBoxVariableEditor', () => {
  let textBoxVar: TextBoxVariable;
  beforeEach(async () => {
    const result = await buildTestScene();
    textBoxVar = result.textBoxVar;
  });

  it('renders default value if any', () => {
    const onChange = jest.fn();
    render(<TextBoxVariableEditor variable={textBoxVar} onChange={onChange} />);

    const input = screen.getByRole('textbox', { name: 'Default value' });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('initial value test');
  });

  it('changes the value', async () => {
    const onChange = jest.fn();
    render(<TextBoxVariableEditor variable={textBoxVar} onChange={onChange} />);

    const input = screen.getByRole('textbox', { name: 'Default value' });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('initial value test');

    // change input value
    const newValue = 'new textbox value';
    await userEvent.clear(input);
    await userEvent.type(input, newValue);

    expect(input).toHaveValue(newValue);

    await userEvent.tab();
    expect(textBoxVar.state.value).toBe(newValue);
  });

  it('renders inline', () => {
    const onChange = jest.fn();
    render(<TextBoxVariableEditor variable={textBoxVar} onChange={onChange} inline={true} />);

    const input = screen.getByDisplayValue(textBoxVar.state.value);
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue(textBoxVar.state.value);

    const legend = screen.queryByText('Text options');
    expect(legend).not.toBeInTheDocument();
  });
});

describe('TextBoxVariableEditor undo/redo', () => {
  it('records a value change made inline as one undoable action', async () => {
    const variable = new TextBoxVariable({ name: 'text', value: 'old' });
    const sidebar = addToEditedDashboard(variable);
    render(<TextBoxVariableEditor variable={variable} onChange={jest.fn()} inline={true} />);

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

  it('does not record a value change made in the settings page', async () => {
    const variable = new TextBoxVariable({ name: 'text', value: 'old' });
    const sidebar = addToEditedDashboard(variable);
    render(<TextBoxVariableEditor variable={variable} onChange={jest.fn()} />);

    await userEvent.clear(screen.getByRole('textbox'));
    await userEvent.type(screen.getByRole('textbox'), 'new');
    await userEvent.tab();

    expect(variable.state.value).toBe('new');
    expect(sidebar.state.undoStack).toHaveLength(0);
  });
});

async function buildTestScene() {
  const textBoxVar = new TextBoxVariable({
    name: 'textBoxVar',
    label: 'textBoxVar',
    type: 'textbox',
    value: 'initial value test',
  });

  return { textBoxVar };
}
