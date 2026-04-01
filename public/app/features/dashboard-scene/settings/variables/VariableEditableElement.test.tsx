import { render, screen } from '@testing-library/react';
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
  it('clicking Change switches selection to VariableTypeChange', async () => {
    const { dashboard } = buildDashboardVariableScene();
    const user = userEvent.setup();

    renderVariableEditPane(dashboard);

    await user.click(screen.getByTestId(selectors.components.PanelEditor.ElementEditPane.changeVariableType));
    expect(dashboard.state.editPane.getSelection()).toBeInstanceOf(VariableTypeChange);
    expect(screen.getByText('Choose variable type')).toBeInTheDocument();
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
