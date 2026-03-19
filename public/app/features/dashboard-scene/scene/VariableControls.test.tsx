import { render, screen } from '@testing-library/react';

import { VariableHide } from '@grafana/data';
import { config } from '@grafana/runtime';
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
        variableDocsInfoLink: true,
      },
    },
  };
});

describe('VariableControls', () => {
  it('should not show scopes variable label but should mount its component', () => {
    const scopesVariable = new ScopesVariable({ hide: VariableHide.hideVariable, name: '__scopes' });
    const variables = [scopesVariable];
    const dashboard = buildScene(variables);
    dashboard.activate();

    render(<VariableControls dashboard={dashboard} />);
    expect(screen.queryByText('__scopes')).not.toBeInTheDocument();
  });

  it('should not show scopes variable in edit mode but should mount its component', () => {
    const scopesVariable = new ScopesVariable({ hide: VariableHide.hideVariable, name: '__scopes' });
    const variables = [scopesVariable];
    const dashboard = buildScene(variables);
    dashboard.activate();
    dashboard.setState({ isEditing: true });

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

  it('should not render hidden variables in edit mode', async () => {
    const scopesVariable = new ScopesVariable({ hide: VariableHide.hideVariable, name: '__scopes' });
    const hiddenVariable = new TextBoxVariable({ name: 'HiddenVar', hide: VariableHide.hideVariable });
    const variables = [scopesVariable, hiddenVariable];
    const dashboard = buildScene(variables);
    dashboard.activate();

    dashboard.setState({ isEditing: true });
    render(<VariableControls dashboard={dashboard} />);

    expect(screen.queryByText('HiddenVar')).not.toBeInTheDocument();
    expect(screen.queryByText('__scopes')).not.toBeInTheDocument();
  });

  it('should not render variables hidden in controls menu in edit mode', async () => {
    const dashboard = buildScene([new TextBoxVariable({ name: 'TextVarControls', hide: VariableHide.inControlsMenu })]);
    dashboard.activate();

    dashboard.setState({ isEditing: true });
    render(<VariableControls dashboard={dashboard} />);

    expect(screen.queryByText('TextVarControls')).not.toBeInTheDocument();
  });

  it('should render visible variables in edit mode', async () => {
    const dashboard = buildScene([new TextBoxVariable({ name: 'TextVarVisible', hide: VariableHide.dontHide })]);
    dashboard.activate();

    dashboard.setState({ isEditing: true });
    render(<VariableControls dashboard={dashboard} />);

    expect(await screen.findByText('TextVarVisible')).toBeInTheDocument();
  });

  it('should render a docs link on variable info icon when docsUrl is set', async () => {
    const docsUrlProps: Record<string, unknown> = { docsUrl: 'https://grafana.com/docs' };
    const dashboard = buildScene([
      new TextBoxVariable({
        name: 'TextVarWithDocs',
        description: 'Text variable docs',
        hide: VariableHide.dontHide,
        ...docsUrlProps,
      }),
    ]);
    dashboard.activate();

    render(<VariableControls dashboard={dashboard} />);

    const docsLink = await screen.findByTestId('variable-description-docs-link');
    expect(docsLink).toHaveAttribute('href', 'https://grafana.com/docs');
    expect(docsLink).toHaveAttribute('target', '_blank');
    expect(docsLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should render a non-clickable info icon when docsUrl is not present in state', async () => {
    const dashboard = buildScene([
      new TextBoxVariable({
        name: 'TextVarNoDocs',
        description: 'Text variable without docs',
        hide: VariableHide.dontHide,
      }),
    ]);
    dashboard.activate();

    render(<VariableControls dashboard={dashboard} />);

    expect(await screen.findByTestId('variable-description-info-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('variable-description-docs-link')).not.toBeInTheDocument();
  });

  it('should not render a docs link when variableDocsInfoLink toggle is off', async () => {
    const originalToggle = config.featureToggles.variableDocsInfoLink;
    config.featureToggles.variableDocsInfoLink = false;

    const docsUrlProps: Record<string, unknown> = { docsUrl: 'https://grafana.com/docs' };
    const dashboard = buildScene([
      new TextBoxVariable({
        name: 'TextVarToggleOff',
        description: 'Text variable with toggle off',
        hide: VariableHide.dontHide,
        ...docsUrlProps,
      }),
    ]);
    dashboard.activate();

    render(<VariableControls dashboard={dashboard} />);

    expect(await screen.findByTestId('variable-description-info-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('variable-description-docs-link')).not.toBeInTheDocument();

    config.featureToggles.variableDocsInfoLink = originalToggle;
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
