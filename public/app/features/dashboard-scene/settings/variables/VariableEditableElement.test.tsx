import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, useMemo } from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { selectors } from '@grafana/e2e-selectors';
import { CustomVariable, SceneTimeRange, SceneVariableSet, useSceneObjectState } from '@grafana/scenes';
import { Sidebar, useSidebar } from '@grafana/ui';

import { ElementEditPane } from '../../edit-pane/ElementEditPane';
import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

import { shouldHideControlsMenuOption } from './VariableEditableElement';
import { VariableTypeChange } from './VariableTypeSelectionPane';

describe('shouldHideControlsMenuOption', () => {
  it('returns false for dashboard-level variables', () => {
    const variable = new CustomVariable({ name: 'env', query: 'prod,dev', value: 'prod', text: 'prod' });
    const variableSet = new SceneVariableSet({ variables: [variable] });

    new DashboardScene({
      $variables: variableSet,
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      body: AutoGridLayoutManager.createEmpty(),
      isEditing: true,
    });

    expect(shouldHideControlsMenuOption(variable)).toBe(false);
  });

  it('returns true for section-level variables', () => {
    const variable = new CustomVariable({ name: 'env', query: 'prod,dev', value: 'prod', text: 'prod' });
    const variableSet = new SceneVariableSet({ variables: [variable] });

    new RowItem({ $variables: variableSet });

    expect(shouldHideControlsMenuOption(variable)).toBe(true);
  });

  it('returns true when variable parent is not a SceneVariableSet', () => {
    const variable = new CustomVariable({ name: 'env', query: 'prod,dev', value: 'prod', text: 'prod' });

    expect(shouldHideControlsMenuOption(variable)).toBe(true);
  });
});

describe('VariableEditableElement', () => {
  it('switches a dashboard variable type from the sidebar and preserves name and label', async () => {
    const { dashboard, variableSet } = buildDashboardVariableScene();
    const variable = variableSet.state.variables[0];
    const user = userEvent.setup();

    renderVariableEditPane(dashboard);

    await user.click(screen.getByTestId(selectors.components.PanelEditor.ElementEditPane.changeVariableType));
    expect(dashboard.state.editPane.getSelection()).toBeInstanceOf(VariableTypeChange);
    expect(screen.getByText('Choose variable type')).toBeInTheDocument();

    await user.click(
      within(screen.getByTestId(selectors.components.PanelEditor.ElementEditPane.variableType('constant'))).getByRole(
        'button',
        { name: 'Constant' }
      )
    );

    await waitFor(() => expect(variableSet.state.variables[0]).not.toBe(variable));

    const updatedVariable = variableSet.state.variables[0];
    expect(updatedVariable.state.type).toBe('constant');
    expect(updatedVariable.state.name).toBe('service');
    expect(updatedVariable.state.label).toBe('Service');
    expect(dashboard.state.editPane.getSelection()).toBe(updatedVariable);
    expect(screen.getByTestId(selectors.components.PanelEditor.ElementEditPane.variableNameInput)).toHaveValue(
      'service'
    );
    expect(screen.getByTestId(selectors.components.PanelEditor.ElementEditPane.variableLabelInput)).toHaveValue(
      'Service'
    );
  });

  it('switches a section variable type from the sidebar without changing its name', async () => {
    const { dashboard, dashboardVariable, sectionVariableSet } = buildSectionVariableScene();
    const sectionVariable = sectionVariableSet.state.variables[0];
    const user = userEvent.setup();

    renderVariableEditPane(dashboard);

    await user.click(screen.getByTestId(selectors.components.PanelEditor.ElementEditPane.changeVariableType));
    expect(dashboard.state.editPane.getSelection()).toBeInstanceOf(VariableTypeChange);
    await user.click(
      within(screen.getByTestId(selectors.components.PanelEditor.ElementEditPane.variableType('textbox'))).getByRole(
        'button',
        { name: 'Textbox' }
      )
    );

    await waitFor(() => expect(sectionVariableSet.state.variables[0]).not.toBe(sectionVariable));

    const updatedVariable = sectionVariableSet.state.variables[0];
    expect(updatedVariable.state.type).toBe('textbox');
    expect(updatedVariable.state.name).toBe('shared');
    expect(updatedVariable.state.label).toBe('Section variable');
    expect(dashboardVariable.state.name).toBe('shared');
    expect(dashboard.state.editPane.getSelection()).toBe(updatedVariable);
  });
});

function VariableEditPaneHarness({ dashboard }: { dashboard: DashboardScene }) {
  const editPane = dashboard.state.editPane;
  const { selection } = useSceneObjectState(editPane, { shouldActivateOrKeepAlive: true });
  const selectedObject = selection?.getFirstObject();
  const editableElement = useMemo(() => selection?.createSelectionElement(), [selection]);
  const isNewElement = selection?.isNewElement() ?? false;

  if (!editableElement) {
    return null;
  }

  return (
    <Sidebar.OpenPane>
      <ElementEditPane
        key={selectedObject?.state.key}
        editPane={editPane}
        element={editableElement}
        isNewElement={isNewElement}
      />
    </Sidebar.OpenPane>
  );
}

function WrapSidebar({ children }: { children: ReactNode }) {
  const sidebarContext = useSidebar({});

  return <Sidebar contextValue={sidebarContext}>{children}</Sidebar>;
}

function renderVariableEditPane(dashboard: DashboardScene) {
  render(
    <TestProvider>
      <WrapSidebar>
        <VariableEditPaneHarness dashboard={dashboard} />
      </WrapSidebar>
    </TestProvider>
  );
}

function buildDashboardVariableScene() {
  const variable = new CustomVariable({
    name: 'service',
    label: 'Service',
    query: 'api,web',
    value: 'api',
    text: 'api',
  });
  const variableSet = new SceneVariableSet({ variables: [variable] });
  const dashboard = new DashboardScene({
    $variables: variableSet,
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    body: AutoGridLayoutManager.createEmpty(),
    isEditing: true,
  });

  activateFullSceneTree(dashboard);
  dashboard.state.editPane.selectObject(variable, variable.state.key!, { force: true });

  return { dashboard, variableSet };
}

function buildSectionVariableScene() {
  const dashboardVariable = new CustomVariable({
    name: 'shared',
    label: 'Dashboard variable',
    query: 'prod,dev',
    value: 'prod',
    text: 'prod',
  });
  const sectionVariable = new CustomVariable({
    name: 'shared',
    label: 'Section variable',
    query: 'a,b',
    value: 'a',
    text: 'a',
  });
  const sectionVariableSet = new SceneVariableSet({ variables: [sectionVariable] });
  const row = new RowItem({ title: 'Row', $variables: sectionVariableSet });
  const dashboard = new DashboardScene({
    $variables: new SceneVariableSet({ variables: [dashboardVariable] }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    body: new RowsLayoutManager({ rows: [row] }),
    isEditing: true,
  });

  activateFullSceneTree(dashboard);
  dashboard.state.editPane.selectObject(sectionVariable, sectionVariable.state.key!, { force: true });

  return { dashboard, dashboardVariable, sectionVariableSet };
}
