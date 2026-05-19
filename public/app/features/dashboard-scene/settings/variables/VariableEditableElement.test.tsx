import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { selectors } from '@grafana/e2e-selectors';
import { CustomVariable, SceneTimeRange, SceneVariableSet } from '@grafana/scenes';
import { Sidebar, useSidebar } from '@grafana/ui';

import { DashboardEditPaneRenderer } from '../../edit-pane/DashboardEditPaneRenderer';
import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { DashboardInteractions } from '../../utils/interactions';
import { activateFullSceneTree } from '../../utils/test-utils';

import { shouldHideControlsMenuOption, VariableEditableElement } from './VariableEditableElement';
import { VariableTypeChangePane } from './VariableTypeSelectionPane';

jest.mock('../../utils/interactions', () => ({
  DashboardInteractions: {
    variableActionButtonClicked: jest.fn(),
  },
}));

const variableActionButtonClickedMock = jest.mocked(DashboardInteractions.variableActionButtonClicked);

function buildTestVariables() {
  const var1 = new CustomVariable({ name: 'query0', query: 'a, b, c' });
  const var2 = new CustomVariable({ name: 'query1', query: 'd, e, f' });
  const set = new SceneVariableSet({ variables: [var1, var2] });
  return { var1, var2, set };
}

function buildTestScene($variables: SceneVariableSet) {
  const dashboard = new DashboardScene({ $variables });
  activateFullSceneTree(dashboard);
  return dashboard;
}

describe('VariableEditableElement', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onDuplicate', () => {
    describe('when the variable is in a SceneVariableSet', () => {
      test('adds a clone and tracks the interaction', () => {
        const { var1, set } = buildTestVariables();
        buildTestScene(set);

        const element = new VariableEditableElement(var1);
        element.onDuplicate();

        expect(set.state.variables).toHaveLength(3);

        const cloned = set.state.variables[2] as CustomVariable;
        expect(cloned).toBeInstanceOf(CustomVariable);

        expect(cloned).not.toBe(var1);
        expect(cloned.state.key).not.toBe(var1.state.key);

        expect(cloned.state.name).toBe(`${var1.state.name}_copy2`);
        expect(cloned.state.query).toBe(var1.state.query);

        expect(variableActionButtonClickedMock).toHaveBeenCalledWith('duplicate', { type: 'custom' });
      });
    });

    describe('when the variable is not in a SceneVariableSet', () => {
      test('does nothing', () => {
        const element = new VariableEditableElement(new CustomVariable({ name: 'orphan', query: 'x' }));

        element.onDuplicate();

        expect(variableActionButtonClickedMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('onDelete', () => {
    describe('when the variable is in a SceneVariableSet', () => {
      test('removes it and tracks the interaction', () => {
        const { var1, var2, set } = buildTestVariables();
        buildTestScene(set);

        const element = new VariableEditableElement(var1);
        element.onDelete();

        expect(set.state.variables).toHaveLength(1);
        expect(set.state.variables[0]).toBe(var2);

        expect(DashboardInteractions.variableActionButtonClicked).toHaveBeenCalledWith('delete', { type: 'custom' });
      });
    });

    describe('when the variable is not in a SceneVariableSet', () => {
      test('does nothing', () => {
        const element = new VariableEditableElement(new CustomVariable({ name: 'orphan', query: 'x' }));

        element.onDelete();

        expect(DashboardInteractions.variableActionButtonClicked).not.toHaveBeenCalled();
      });
    });
  });

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
});

describe('VariableEditableElement', () => {
  it('clicking Change switches selection to VariableTypeChange', async () => {
    const { dashboard } = buildDashboardVariableScene();
    const user = userEvent.setup();

    renderVariableEditPane(dashboard);

    await user.click(screen.getByTestId(selectors.components.PanelEditor.ElementEditPane.changeVariableType));
    expect(dashboard.state.editPane.state.openPane).toBeInstanceOf(VariableTypeChangePane);
    expect(screen.getByText('Change variable type')).toBeInTheDocument();
  });
});

function WrapSidebar({ children }: { children: ReactNode }) {
  const sidebarContext = useSidebar({});

  return <Sidebar contextValue={sidebarContext}>{children}</Sidebar>;
}

function renderVariableEditPane(dashboard: DashboardScene) {
  const editPane = dashboard.state.editPane;

  render(
    <TestProvider>
      <WrapSidebar>
        <DashboardEditPaneRenderer editPane={editPane} dashboard={dashboard} />
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
  dashboard.state.editPane.selectObject(variable, { force: true });

  return { dashboard, variableSet };
}
