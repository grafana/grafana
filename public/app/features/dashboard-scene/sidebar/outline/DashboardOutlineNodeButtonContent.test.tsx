import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CustomVariable, SceneVariableSet } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { VariableEditableElement } from '../../settings/variables/VariableEditableElement';
import { useOutlineRename } from '../useOutlineRename';

import { DashboardOutlineNodeButtonContent } from './DashboardOutlineNodeButtonContent';

function RenameVariable({ element }: { element: VariableEditableElement }) {
  element.variable.useState();
  const rename = useOutlineRename(element, true);
  const elementInfo = element.getEditableElementInfo();
  return (
    <button onDoubleClick={rename.onNameDoubleClicked}>
      <DashboardOutlineNodeButtonContent
        elementInfo={elementInfo}
        instanceName={elementInfo.instanceName}
        isCloned={false}
        {...rename}
      />
    </button>
  );
}

function setup() {
  const variable = new CustomVariable({ name: 'service', label: 'Service', query: 'a,b' });
  new DashboardScene({ $variables: new SceneVariableSet({ variables: [variable] }) });
  render(<RenameVariable element={new VariableEditableElement(variable)} />);
  return { variable, user: userEvent.setup() };
}

describe('labelled variable outline rename', () => {
  it.each(['blur', 'Enter'])('edits the name and preserves the label when committed with %s', async (commit) => {
    const { variable, user } = setup();
    await user.dblClick(screen.getByText('Service'));
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('service');
    await user.clear(input);
    await user.type(input, 'backend');
    expect(input).toHaveValue('backend');
    if (commit === 'Enter') {
      await user.keyboard('{Enter}');
    } else {
      await user.tab();
    }
    expect(variable.state.name).toBe('backend');
    expect(variable.state.label).toBe('Service');
    expect(screen.getByText('Service')).toBeInTheDocument();
  });

  it('restores the original name instead of the label after invalid input', async () => {
    const { variable, user } = setup();
    await user.dblClick(screen.getByText('Service'));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'invalid name');
    await user.tab();
    expect(variable.state.name).toBe('service');
    expect(variable.state.label).toBe('Service');
    expect(screen.getByText('Service')).toBeInTheDocument();
  });
});
