import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { of } from 'rxjs';
import { getWrapper } from 'test/test-utils';

import { VariableRefresh } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { setPluginLinksHook } from '@grafana/runtime';
import { CustomVariable, QueryVariable, SceneTimeRange, type SceneVariable, SceneVariableSet } from '@grafana/scenes';
import { mockBoundingClientRect } from '@grafana/test-utils';
import { Sidebar, useSidebar } from '@grafana/ui';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { DashboardSidebarRenderer } from '../../sidebar/DashboardSidebarRenderer';
import { DashboardInteractions } from '../../utils/interactions';
import { activateFullSceneTree } from '../../utils/test-utils';

import { shouldHideControlsMenuOption, VariableEditableElement } from './VariableEditableElement';
import { VariableTypeChangePane } from './VariableTypeSelectionPane';

jest.mock('../../utils/interactions', () => ({
  DashboardInteractions: {
    editSessionStarted: jest.fn(),
    variableActionButtonClicked: jest.fn(),
  },
}));

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  useFlagGrafanaQueryVarEditorRedesign: () => true,
}));

const variableActionButtonClickedMock = jest.mocked(DashboardInteractions.variableActionButtonClicked);

const TestWrapper = getWrapper({ renderWithRouter: true });

setPluginLinksHook(() => ({ links: [], isLoading: false }));

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

    renderVariableSidebar(dashboard);

    await user.click(await screen.findByTestId(selectors.components.PanelEditor.ElementEditPane.changeVariableType));
    expect(dashboard.state.sidebar.state.openPane).toBeInstanceOf(VariableTypeChangePane);
    expect(screen.getByText('Change variable type')).toBeInTheDocument();
  });
});

describe('VariableEditableElement undo/redo', () => {
  it('records a multi-value change as one undoable action', async () => {
    const variable = new CustomVariable({ name: 'service', query: 'api,web' });
    const { dashboard } = buildDashboardVariableScene(variable);
    const sidebar = dashboard.state.sidebar;
    const user = userEvent.setup();
    renderVariableSidebar(dashboard);

    await user.click(await screen.findByLabelText('Multi-value'));
    expect(variable.state.isMulti).toBe(true);
    expect(sidebar.state.undoStack).toHaveLength(1);

    act(() => sidebar.undoAction());
    expect(variable.state.isMulti).toBeFalsy();
    expect(screen.getByLabelText('Multi-value')).not.toBeChecked();

    act(() => sidebar.redoAction());
    expect(variable.state.isMulti).toBe(true);
  });

  it('records a custom all value change as one undoable action', async () => {
    const variable = new CustomVariable({ name: 'service', query: 'api,web', includeAll: true, allValue: '.*' });
    const { dashboard } = buildDashboardVariableScene(variable);
    const sidebar = dashboard.state.sidebar;
    const user = userEvent.setup();
    renderVariableSidebar(dashboard);

    await user.clear(await screen.findByLabelText(/^Custom all value/));
    await user.type(screen.getByLabelText(/^Custom all value/), 'all');
    await user.tab();
    expect(variable.state.allValue).toBe('all');
    expect(sidebar.state.undoStack).toHaveLength(1);

    act(() => sidebar.undoAction());
    expect(variable.state.allValue).toBe('.*');
    expect(screen.getByLabelText(/^Custom all value/)).toHaveValue('.*');

    act(() => sidebar.redoAction());
    expect(variable.state.allValue).toBe('all');
    expect(screen.getByLabelText(/^Custom all value/)).toHaveValue('all');
  });

  it('records a query variable refresh change as one undoable action', async () => {
    mockBoundingClientRect();
    const variable = new QueryVariable({ name: 'query', refresh: VariableRefresh.onDashboardLoad });
    jest.spyOn(variable, 'validateAndUpdate').mockReturnValue(of({}));
    const { dashboard } = buildDashboardVariableScene(variable);
    const sidebar = dashboard.state.sidebar;
    const user = userEvent.setup();
    renderVariableSidebar(dashboard);

    const refreshField = await screen.findByTestId('data-testid variable-type Refresh field property editor');
    await user.click(within(refreshField).getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'On time range change' }));
    expect(variable.state.refresh).toBe(VariableRefresh.onTimeRangeChanged);
    expect(sidebar.state.undoStack).toHaveLength(1);

    act(() => sidebar.undoAction());
    expect(variable.state.refresh).toBe(VariableRefresh.onDashboardLoad);

    act(() => sidebar.redoAction());
    expect(variable.state.refresh).toBe(VariableRefresh.onTimeRangeChanged);
  });
});

function WrapSidebar({ children }: { children: ReactNode }) {
  const sidebarContext = useSidebar({});

  return (
    <TestWrapper>
      <Sidebar contextValue={sidebarContext}>{children}</Sidebar>
    </TestWrapper>
  );
}

function renderVariableSidebar(dashboard: DashboardScene) {
  render(
    <WrapSidebar>
      <DashboardSidebarRenderer dashboard={dashboard} />
    </WrapSidebar>
  );
}

function buildDashboardVariableScene(
  variable: SceneVariable = new CustomVariable({
    name: 'service',
    label: 'Service',
    query: 'api,web',
    value: 'api',
    text: 'api',
  })
) {
  const variableSet = new SceneVariableSet({ variables: [variable] });
  const dashboard = new DashboardScene({
    $variables: variableSet,
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    body: AutoGridLayoutManager.createEmpty(),
    isEditing: true,
  });

  activateFullSceneTree(dashboard);
  dashboard.state.sidebar.selectObject(variable, { force: true });

  return { dashboard, variableSet };
}
