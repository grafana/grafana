import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ConstantVariable } from '@grafana/scenes';

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
});

async function buildTestScene() {
  const constantVar = new ConstantVariable({
    name: 'constantVar',
    type: 'constant',
    value: 'constant value',
  });

  return { constantVar };
}
