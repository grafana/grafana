import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SwitchVariable } from '@grafana/scenes';

import { SwitchVariableEditor } from './SwitchVariableEditor';

describe('SwitchVariableEditor', () => {
  it('should render with default value false', () => {
    const variable = new SwitchVariable({ name: 'test', value: false });
    render(<SwitchVariableEditor variable={variable} onChange={() => {}} />);

    const switchElement = screen.getByRole('switch');
    expect(switchElement).not.toBeChecked();
  });

  it('should render with default value true', () => {
    const variable = new SwitchVariable({ name: 'test', value: true });
    render(<SwitchVariableEditor variable={variable} onChange={() => {}} />);

    const switchElement = screen.getByRole('switch');
    expect(switchElement).toBeChecked();
  });

  it('should update variable state when switch is clicked', async () => {
    const variable = new SwitchVariable({ name: 'test', value: false });
    const user = userEvent.setup();

    render(<SwitchVariableEditor variable={variable} onChange={() => {}} />);

    const switchElement = screen.getByRole('switch');
    await user.click(switchElement);

    expect(variable.state.value).toBe(true);
  });
});
