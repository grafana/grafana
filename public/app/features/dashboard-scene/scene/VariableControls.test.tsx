import { render, screen } from '@testing-library/react';

import { VariableHide } from '@grafana/data';
import { SceneGridLayout, SceneVariable, SceneVariableSet, ScopesVariable, TextBoxVariable } from '@grafana/scenes';

import { DashboardScene } from './DashboardScene';
import { VariableControls } from './VariableControls';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

jest.mock('@grafana/runtime', () => {
  const runtime = jest.requireActual('@grafana/runtime');
  return {
    ...runtime,
    config: {
      ...runtime.config,
      featureToggles: {
        dashboardNewLayouts: true,
      },
    },
  };
});

describe('VariableControls', () => {
  it('should not render scopes variable', () => {
    const variables = [new ScopesVariable({})];
    const dashboard = buildScene(variables);
    dashboard.activate();

    render(<VariableControls dashboard={dashboard} />);

    expect(screen.queryByText('__scopes')).not.toBeInTheDocument();
  });

  it('should not render regular hidden variables', () => {
    const hiddenVariable = new TextBoxVariable({
      name: 'HiddenVar',
      hide: VariableHide.hideVariable,
    });
    const variables = [hiddenVariable];
    const dashboard = buildScene(variables);
    dashboard.activate();

    render(<VariableControls dashboard={dashboard} />);

    expect(screen.queryByText('HiddenVar')).not.toBeInTheDocument();
  });

  it('should render regular hidden variables in edit mode', async () => {
    const hiddenVariable = new TextBoxVariable({
      name: 'HiddenVar',
      hide: VariableHide.hideVariable,
    });
    const variables = [hiddenVariable];
    const dashboard = buildScene(variables);
    dashboard.activate();

    dashboard.setState({ isEditing: true });
    render(<VariableControls dashboard={dashboard} />);

    expect(await screen.findByText('HiddenVar')).toBeInTheDocument();
  });

  it('should not render variables hidden in controls menu in edit mode', async () => {
    const dashboard = buildScene([new TextBoxVariable({ name: 'TextVarControls', hide: VariableHide.inControlsMenu })]);
    dashboard.activate();

    dashboard.setState({ isEditing: true });
    render(<VariableControls dashboard={dashboard} />);

    expect(screen.queryByText('TextVarControls')).not.toBeInTheDocument();
  });
});

function buildScene(variables: SceneVariable[] = []) {
  const dashboard = new DashboardScene({
    $variables: new SceneVariableSet({ variables }),
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [],
      }),
    }),
  });
  return dashboard;
}
