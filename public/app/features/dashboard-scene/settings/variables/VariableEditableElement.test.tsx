import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { of } from 'rxjs';
import { getWrapper } from 'test/test-utils';

import { VariableRefresh } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { setPluginLinksHook } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { CustomVariable, QueryVariable, SceneTimeRange, type SceneVariable, SceneVariableSet } from '@grafana/scenes';
import { mockBoundingClientRect } from '@grafana/test-utils';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { Sidebar, useSidebar } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { DashboardSidebarRenderer } from '../../sidebar/DashboardSidebarRenderer';
import { DashboardInteractions } from '../../utils/interactions';
import { toControlSourceRef } from '../../utils/predefinedVariables';
import { activateFullSceneTree } from '../../utils/test-utils';

import { shouldHideControlsMenuOption, VariableEditableElement } from './VariableEditableElement';
import { VariableTypeChangePane } from './VariableTypeSelectionPane';

jest.mock('../../utils/interactions', () => ({
  DashboardInteractions: {
    editSessionStarted: jest.fn(),
    editPeriodStarted: jest.fn(),
    editPeriodEnded: jest.fn(),
    editActorFirstChange: jest.fn(),
    variableActionButtonClicked: jest.fn(),
    trackDeleteDashboardElement: jest.fn(),
  },
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
  it.each([
    ['global', { type: 'global' as const }, 'This variable is defined globally'],
    ['folder', { type: 'folder' as const, folderUid: 'folder-1' }, 'This variable is defined on this folder'],
  ])('disables editing when the variable is defined at %s scope', async (_scope, origin, notice) => {
    const variable = new CustomVariable({
      name: 'edition',
      label: 'Edition',
      query: 'a,b',
      origin: toControlSourceRef(origin),
    });
    const dashboard = new DashboardScene({
      $variables: new SceneVariableSet({ variables: [variable] }),
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      body: AutoGridLayoutManager.createEmpty(),
      isEditing: true,
    });
    activateFullSceneTree(dashboard);
    dashboard.state.sidebar.selectObject(variable, { force: true });
    renderVariableSidebar(dashboard);

    expect(await screen.findByText(notice)).toBeInTheDocument();
    expect(screen.getByTestId(selectors.components.PanelEditor.ElementEditPane.variableNameInput)).toBeDisabled();
    expect(screen.getByTestId(selectors.components.PanelEditor.ElementEditPane.variableLabelInput)).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Multi-value' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: /Include All value/ })).toBeDisabled();
    expect(screen.getByRole('switch', { name: /Allow custom values/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Open variable editor' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId(selectors.components.PanelEditor.ElementEditPane.changeVariableType)).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.EditPaneHeader.duplicate)).not.toBeInTheDocument();
  });

  it('asks to remove an opted-in variable from the dashboard', async () => {
    const publishSpy = jest.spyOn(appEvents, 'publish').mockImplementation(() => undefined);
    const variable = new CustomVariable({
      name: 'edition',
      query: 'a,b',
      origin: toControlSourceRef({ type: 'global' }),
    });
    const dashboard = new DashboardScene({
      $variables: new SceneVariableSet({ variables: [variable] }),
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      body: AutoGridLayoutManager.createEmpty(),
      isEditing: true,
    });
    activateFullSceneTree(dashboard);
    dashboard.state.sidebar.selectObject(variable, { force: true });
    renderVariableSidebar(dashboard);

    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    expect(publishSpy).toHaveBeenCalledWith(expect.any(ShowConfirmModalEvent));
    const event = publishSpy.mock.calls.find(([published]) => published instanceof ShowConfirmModalEvent)?.[0];
    expect(event).toMatchObject({
      payload: {
        title: 'Remove variable',
        text: 'Are you sure you want to remove: edition?',
        yesText: 'Remove',
      },
    });
    publishSpy.mockRestore();
  });

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
  it.each([
    { label: /Include All value/, property: 'includeAll' as const, initial: false, changed: true },
    { label: /Allow custom values/, property: 'allowCustomValue' as const, initial: undefined, changed: false },
  ])('restores $property through undo and redo', async ({ label, property, initial, changed }) => {
    const variable = new CustomVariable({ name: 'service', query: 'api,web', [property]: initial });
    const { dashboard } = buildDashboardVariableScene(variable);
    const sidebar = dashboard.state.sidebar;
    const user = userEvent.setup();
    renderVariableSidebar(dashboard);

    await user.click(await screen.findByLabelText(label));
    expect(variable.state[property]).toBe(changed);
    expect(screen.getByLabelText(label)).toHaveProperty('checked', changed);
    expect(sidebar.state.undoStack).toHaveLength(1);

    act(() => sidebar.undoAction());
    expect(variable.state[property]).toBe(initial);
    expect(screen.getByLabelText(label)).toHaveProperty('checked', initial ?? true);

    act(() => sidebar.redoAction());
    expect(variable.state[property]).toBe(changed);
    expect(screen.getByLabelText(label)).toHaveProperty('checked', changed);
  });

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

  it('does not record leaving an unset custom all value empty', async () => {
    const variable = new CustomVariable({ name: 'service', query: 'api,web', includeAll: true });
    const { dashboard } = buildDashboardVariableScene(variable);
    const sidebar = dashboard.state.sidebar;
    const user = userEvent.setup();
    renderVariableSidebar(dashboard);

    await user.click(await screen.findByLabelText(/^Custom all value/));
    await user.tab();

    expect(screen.getByLabelText(/^Custom all value/)).toHaveValue('');
    expect(variable.state.allValue).toBeUndefined();
    expect(sidebar.state.undoStack).toHaveLength(0);
  });

  it('records a query variable refresh change as one undoable action', async () => {
    setTestFlags({ [FlagKeys.GrafanaQueryVarEditorRedesign]: true });
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
