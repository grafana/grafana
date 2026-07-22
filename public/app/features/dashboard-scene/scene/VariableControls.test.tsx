import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { render as RTLRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';

import { VariableHide } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  CustomVariable,
  LocalValueVariable,
  SceneGridLayout,
  type SceneVariable,
  SceneVariableSet,
  ScopesVariable,
  TextBoxVariable,
} from '@grafana/scenes';
import { getTestFeatureFlagClient, setTestFlags } from '@grafana/test-utils/unstable';

import { toControlSourceRef } from '../utils/predefinedVariables';

import { DashboardScene } from './DashboardScene';
import { SectionVariableControls, VariableControls } from './VariableControls';
import { AutoGridLayoutManager } from './layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';
import { RowItem } from './layout-rows/RowItem';

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

function render(ui: ReactNode) {
  return RTLRender(<OpenFeatureProvider client={getTestFeatureFlagClient()}>{ui}</OpenFeatureProvider>);
}

describe('VariableControls', () => {
  beforeEach(() => {
    setTestFlags({ dashboardNewLayouts: false });
  });

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

  it('should allow changing predefined variable values in edit mode', async () => {
    const dashboard = buildScene([
      new CustomVariable({
        name: 'globalVar',
        query: 'a,b',
        value: 'a',
        text: 'a',
        origin: toControlSourceRef({ type: 'global' }),
      }),
    ]);
    dashboard.activate();
    dashboard.setState({ isEditing: true });

    render(<VariableControls dashboard={dashboard} />);

    const valueSelect = await screen.findByTestId(
      selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('a')
    );
    const inputElement = valueSelect.querySelector('input');
    expect(inputElement).not.toBeDisabled();
  });

  it('should allow changing predefined variable values in view mode', async () => {
    const dashboard = buildScene([
      new CustomVariable({
        name: 'globalVar',
        query: 'a,b',
        value: 'a',
        text: 'a',
        origin: toControlSourceRef({ type: 'global' }),
      }),
    ]);
    dashboard.activate();

    render(<VariableControls dashboard={dashboard} />);

    expect(await screen.findByText('globalVar')).toBeInTheDocument();

    const valueSelect = await screen.findByTestId(
      selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('a')
    );
    const inputElement = valueSelect.querySelector('input');
    expect(inputElement).not.toBeDisabled();
  });

  it('should not show edit/delete hover actions for predefined variables in edit mode', async () => {
    const user = userEvent.setup();
    const dashboard = buildScene([
      new CustomVariable({
        name: 'globalVar',
        query: 'a,b',
        origin: toControlSourceRef({ type: 'global' }),
      }),
    ]);
    dashboard.activate();
    dashboard.setState({ isEditing: true });

    render(<VariableControls dashboard={dashboard} />);

    await user.hover(await screen.findByText('globalVar'));

    expect(screen.queryByLabelText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Delete')).not.toBeInTheDocument();
  });

  it('should show an origin icon for global predefined variables without a description', async () => {
    const dashboard = buildScene([
      new CustomVariable({
        name: 'globalVar',
        query: 'a,b',
        origin: toControlSourceRef({ type: 'global' }),
      }),
    ]);
    dashboard.activate();

    render(<VariableControls dashboard={dashboard} />);

    expect(await screen.findByText('globalVar')).toBeInTheDocument();
    expect(screen.getByLabelText('Global variable, shared across all dashboards')).toBeInTheDocument();
  });

  it('should show an origin icon for folder predefined variables without a description', async () => {
    const dashboard = buildScene([
      new CustomVariable({
        name: 'folderVar',
        query: 'a,b',
        origin: toControlSourceRef({ type: 'folder', folderUid: 'folder-1' }),
      }),
    ]);
    dashboard.activate();

    render(<VariableControls dashboard={dashboard} />);

    expect(await screen.findByText('folderVar')).toBeInTheDocument();
    expect(screen.getByLabelText("Folder variable, inherited from this dashboard's folder")).toBeInTheDocument();
  });

  it('should prefer variablesOverride over dashboard variables', async () => {
    const dashboard = buildScene([new TextBoxVariable({ name: 'DashboardVar' })]);
    dashboard.activate();

    const sectionVariable = new TextBoxVariable({ name: 'SectionAncestorVar' });
    render(<VariableControls dashboard={dashboard} variablesOverride={[sectionVariable]} />);

    expect(await screen.findByText('SectionAncestorVar')).toBeInTheDocument();
    expect(screen.queryByText('DashboardVar')).not.toBeInTheDocument();
  });

  it('should hide local repeat variables in section controls', () => {
    const variableSet = new SceneVariableSet({
      variables: [
        new LocalValueVariable({ name: 'custom0', value: 'glo3', text: 'glo3' }),
        new CustomVariable({ name: 'custom0', query: 'sec1,sec2', value: ['sec1'], text: ['sec1'] }),
      ],
    });

    const row = new RowItem({
      repeatByVariable: 'custom0',
      $variables: variableSet,
      layout: AutoGridLayoutManager.createEmpty(),
    });

    render(<SectionVariableControls variableSet={row.state.$variables!} />);

    expect(screen.queryAllByText('custom0')).toHaveLength(1);
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
