import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TextBoxVariable } from '@grafana/scenes';

import { TextBoxVariableEditor } from './TextBoxVariableEditor';
import { VariableType } from '@grafana/data';

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
    const variable = new TextBoxVariable({
      name: 'textBoxVar',
      label: 'textBoxVar',
      type: 'textbox',
      value: 'initial value test',
    });
    render(<TextBoxVariableEditor variable={variable} onChange={onChange} inline={true}/>);
  
    const input = screen.getByDisplayValue(variable.state.value);
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue(variable.state.value);

    const legend = screen.queryByText('Text options');
    expect(legend).not.toBeInTheDocument();
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
