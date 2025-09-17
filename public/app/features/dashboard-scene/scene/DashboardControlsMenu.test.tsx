import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SceneVariableSet, TextBoxVariable, QueryVariable, CustomVariable, SceneVariable } from '@grafana/scenes';

import {
  DASHBOARD_CONTROLS_MENU_ARIA_LABEL,
  DASHBOARD_CONTROLS_MENU_TITLE,
  DashboardControlsButton,
} from './DashboardControlsMenu';
import { DashboardScene } from './DashboardScene';

describe('DashboardControlsMenu', () => {
  it('should return null and not render anything when there are no variables', () => {
    const { container } = render(<DashboardControlsButton dashboard={getDashboard([])} />);
    expect(container.firstChild).toBeNull();
  });

  it('should return null when variables exist but none of them is meant to be shown in the controls menu', () => {
    const variables = [
      new TextBoxVariable({
        name: 'textVar',
        value: 'test',
        showInControlsMenu: false,
      }),
    ];
    const { container } = render(<DashboardControlsButton dashboard={getDashboard(variables)} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render a dropdown with a toolbar-button when there are any variables that are set to be shown under the controls menu', () => {
    const variables = [
      new TextBoxVariable({
        name: 'textVar',
        value: 'test',
        showInControlsMenu: true,
      }),
    ];

    render(<DashboardControlsButton dashboard={getDashboard(variables)} />);

    // Should render the toolbar button
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', DASHBOARD_CONTROLS_MENU_ARIA_LABEL);
    expect(button).toHaveAttribute('title', DASHBOARD_CONTROLS_MENU_TITLE);
  });

  it('should render multiple variables in dropdown menu', async () => {
    const variables = [
      new TextBoxVariable({
        name: 'textVar1',
        value: 'test1',
        showInControlsMenu: true,
      }),
      new TextBoxVariable({
        name: 'textVar2',
        value: 'test2',
        showInControlsMenu: true,
      }),
      new QueryVariable({
        name: 'queryVar',
        query: 'test query',
        showInControlsMenu: true,
      }),
    ];

    act(() => {
      render(<DashboardControlsButton dashboard={getDashboard(variables)} />);
    });

    // Should have rendered a dropdown
    expect(screen.getByRole('button')).toBeInTheDocument();

    // Open the dropdown
    userEvent.click(screen.getByRole('button'));
    expect(await screen.findByText('textVar1')).toBeInTheDocument();
    expect(await screen.findByText('textVar2')).toBeInTheDocument();
    expect(await screen.findByText('queryVar')).toBeInTheDocument();
  });

  it('should filter out variables with showInControlsMenu=false', async () => {
    const variables = [
      new TextBoxVariable({
        name: 'textVar1',
        value: 'test1',
        showInControlsMenu: true,
      }),
      new TextBoxVariable({
        name: 'textVar2',
        value: 'test2',
        showInControlsMenu: false, // This should be filtered out
      }),
      new CustomVariable({
        name: 'customVar',
        query: 'option1,option2',
        showInControlsMenu: true,
      }),
    ];

    render(<DashboardControlsButton dashboard={getDashboard(variables)} />);

    // Should still render dropdown since we have variables with showInControlsMenu=true
    expect(screen.getByRole('button')).toBeInTheDocument();

    // Open the dropdown
    userEvent.click(screen.getByRole('button'));
    expect(await screen.findByText('textVar1')).toBeInTheDocument();
    expect(await screen.findByText('customVar')).toBeInTheDocument();
    expect(screen.queryByText('textVar2')).not.toBeInTheDocument();
  });
});

function getDashboard(variables: SceneVariable[]): DashboardScene {
  return new DashboardScene({
    uid: 'test-dashboard',
    title: 'Test Dashboard',
    $variables: new SceneVariableSet({
      variables,
    }),
  });
}
