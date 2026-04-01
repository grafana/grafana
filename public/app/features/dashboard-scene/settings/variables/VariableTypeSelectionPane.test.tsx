import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, useMemo } from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { selectors } from '@grafana/e2e-selectors';
import {
  CustomVariable,
  SceneGridLayout,
  SceneTimeRange,
  SceneVariableSet,
  useSceneObjectState,
} from '@grafana/scenes';
import { Sidebar, useSidebar } from '@grafana/ui';

import { ElementEditPane } from '../../edit-pane/ElementEditPane';
import { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { DashboardInteractions } from '../../utils/interactions';
import { activateFullSceneTree } from '../../utils/test-utils';

import {
  collectDescendantVariables,
  VariableAdd,
  VariableTypeSelection,
  VariableTypeChange,
} from './VariableTypeSelectionPane';

const defaultDsSettings = {
  name: 'TestDataSource',
  uid: 'ds1',
  type: 'test',
  meta: { id: 'test', name: 'Test' },
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: (ref: string | null) => (ref === null ? defaultDsSettings : undefined),
  }),
}));

function buildTestScene() {
  const testScene = new DashboardScene({
    $variables: new SceneVariableSet({ variables: [] }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    isEditing: true,
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [],
      }),
    }),
  });
  activateFullSceneTree(testScene);
  return testScene;
}

function buildTestSceneWithRowSectionVariable(sectionVarName: string) {
  const sectionVar = new CustomVariable({ name: sectionVarName, query: 'a,b,c' });
  const testScene = new DashboardScene({
    $variables: new SceneVariableSet({ variables: [] }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    isEditing: true,
    body: new RowsLayoutManager({
      rows: [
        new RowItem({
          title: 'Row 1',
          $variables: new SceneVariableSet({ variables: [sectionVar] }),
        }),
      ],
    }),
  });
  activateFullSceneTree(testScene);
  return testScene;
}

function renderTestScene() {
  const dashboard = buildTestScene();
  const variableAdd = new VariableAdd({ dashboardRef: dashboard.getRef() });
  return render(<VariableTypeSelection variableAdd={variableAdd} />);
}

describe('VariableAddEditableElement', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls DashboardInteractions.variableTypeSelected when a variable type is clicked', () => {
    const variableTypeSelectedSpy = jest.spyOn(DashboardInteractions, 'variableTypeSelected');

    const { getByRole } = renderTestScene();

    getByRole('button', { name: /query/i }).click();

    expect(variableTypeSelectedSpy).toHaveBeenCalledWith({ type: 'query' });
  });

  it('generates a non-conflicting name when a section variable of the same type already exists', () => {
    const dashboard = buildTestSceneWithRowSectionVariable('custom0');
    const variableAdd = new VariableAdd({ dashboardRef: dashboard.getRef() });
    const { getByRole } = render(<VariableTypeSelection variableAdd={variableAdd} />);

    getByRole('button', { name: /custom/i }).click();

    const dashboardVars = dashboard.state.$variables;
    expect(dashboardVars).toBeInstanceOf(SceneVariableSet);
    const vars = (dashboardVars as SceneVariableSet).state.variables;
    expect(vars).toHaveLength(1);
    expect(vars[0].state.name).toBe('custom1');
  });
});

describe('VariableTypeChangeEditableElement', () => {
  it('switches a dashboard variable type and preserves name and label', async () => {
    const { dashboard, variableSet } = buildDashboardVariableScene();
    const variable = variableSet.state.variables[0];
    const user = userEvent.setup();

    renderVariableEditPane(dashboard);

    await user.click(screen.getByTestId(selectors.components.PanelEditor.ElementEditPane.changeVariableType));
    expect(dashboard.state.editPane.getSelection()).toBeInstanceOf(VariableTypeChange);

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

  it('switches a section variable type without changing its name and label', async () => {
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

describe('collectDescendantVariables', () => {
  it('returns an empty array when there are no descendant variable sets', () => {
    const dashboard = buildTestScene();
    expect(collectDescendantVariables(dashboard)).toEqual([]);
  });

  it('collects variables from row section variable sets', () => {
    const dashboard = buildTestSceneWithRowSectionVariable('custom0');
    const result = collectDescendantVariables(dashboard);
    expect(result).toHaveLength(1);
    expect(result[0].state.name).toBe('custom0');
  });

  it('collects variables from multiple rows', () => {
    const sectionVar1 = new CustomVariable({ name: 'custom0', query: 'a,b' });
    const sectionVar2 = new CustomVariable({ name: 'custom1', query: 'c,d' });
    const dashboard = new DashboardScene({
      $variables: new SceneVariableSet({ variables: [] }),
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      isEditing: true,
      body: new RowsLayoutManager({
        rows: [
          new RowItem({
            title: 'Row 1',
            $variables: new SceneVariableSet({ variables: [sectionVar1] }),
          }),
          new RowItem({
            title: 'Row 2',
            $variables: new SceneVariableSet({ variables: [sectionVar2] }),
          }),
        ],
      }),
    });
    activateFullSceneTree(dashboard);

    const result = collectDescendantVariables(dashboard);
    expect(result).toHaveLength(2);
    expect(result.map((v) => v.state.name)).toEqual(expect.arrayContaining(['custom0', 'custom1']));
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
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [],
      }),
    }),
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
    isEditing: true,
    body: new RowsLayoutManager({ rows: [row] }),
  });

  activateFullSceneTree(dashboard);
  dashboard.state.editPane.selectObject(sectionVariable, sectionVariable.state.key!, { force: true });

  return { dashboard, dashboardVariable, sectionVariableSet };
}
