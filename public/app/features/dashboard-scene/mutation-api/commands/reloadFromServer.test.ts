import { SceneGridLayout, SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { ConditionalRenderingData } from '../../conditional-rendering/conditions/ConditionalRenderingData';
import { getPendingChangesHistory, type PendingChangesHistory } from '../../lifecycle/pendingChangePreview';
import { hasUnrecordedPendingChange, reloadKeepingEditMode } from '../../lifecycle/pendingChangesHistory';
import { buildPanelEditScene } from '../../panel-edit/PanelEditor';
import { DashboardScene } from '../../scene/DashboardScene';
import { LibraryPanelBehavior } from '../../scene/LibraryPanelBehavior';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';

import { reloadFromServerCommand } from './reloadFromServer';
import { type MutationContext } from './types';

jest.mock('../../lifecycle/pendingChangePreview', () => ({
  ...jest.requireActual('../../lifecycle/pendingChangePreview'),
  getPendingChangesHistory: jest.fn(),
}));
jest.mock('../../lifecycle/pendingChangesHistory', () => ({
  hasUnrecordedPendingChange: jest.fn(() => false),
  reloadKeepingEditMode: jest.fn(),
}));

function contextFor(state: {
  isDirty: boolean;
  isEditing: boolean;
  editPanel?: ReturnType<typeof buildPanelEditScene>;
}): MutationContext {
  return { scene: { state: { uid: 'abc', meta: {}, ...state } } as unknown as DashboardScene } as MutationContext;
}

function attachAutoGrid(panel: VizPanel) {
  const item = new AutoGridItem({ body: panel });
  new DashboardScene({
    body: new AutoGridLayoutManager({
      layout: new AutoGridLayout({ children: [item], templateColumns: '1fr', rowGap: 0, columnGap: 0 }),
    }),
  });
  return item;
}

describe('RELOAD_FROM_SERVER', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getPendingChangesHistory).mockReset();
  });

  it.each([false, true])('preserves an ordinary Panel Edit draft with plugin history=%s', async (pluginHistory) => {
    const runner = new SceneQueryRunner({ queries: [{ refId: 'A', expression: '1' }] });
    const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries', $data: runner });
    new DashboardGridItem({ body: panel });
    const editor = buildPanelEditScene(panel);
    const context = contextFor({ isDirty: false, isEditing: true, editPanel: editor });
    if (pluginHistory) {
      jest.mocked(getPendingChangesHistory).mockReturnValue({} as PendingChangesHistory);
    }
    runner.setState({ queries: [{ refId: 'A', expression: '2' }] });
    expect(editor.state.isDirty).toBeUndefined();
    expect(await reloadFromServerCommand.handler({}, context)).toMatchObject({
      success: true,
      data: { reloaded: false, reason: 'unsaved-changes' },
    });
    expect(runner.state.queries).toEqual([{ refId: 'A', expression: '2' }]);
    expect(reloadKeepingEditMode).not.toHaveBeenCalled();
    expect(await reloadFromServerCommand.handler({ pendingChanges: 'another-chat' }, context)).toMatchObject({
      success: true,
      data: { reloaded: false, reason: 'unsaved-changes' },
    });
    runner.setState({ queries: [{ refId: 'A', expression: '1' }] });
    expect(await reloadFromServerCommand.handler({}, context)).toMatchObject({
      success: true,
      data: { reloaded: true },
    });
    expect(reloadKeepingEditMode).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    'preserves library panel drafts without false dirty state (auto grid=%s)',
    async (autoGrid) => {
      const runner = new SceneQueryRunner({ queries: [{ refId: 'A', expression: '1' }] });
      const panel = new VizPanel({
        key: 'panel-1',
        pluginId: 'timeseries',
        $data: runner,
        $behaviors: [new LibraryPanelBehavior({ uid: 'lib-uid', name: 'Library panel', isLoaded: true })],
      });
      if (autoGrid) {
        attachAutoGrid(panel);
      } else {
        new DashboardGridItem({ body: panel });
      }
      const editor = buildPanelEditScene(panel);
      const context = contextFor({ isDirty: false, isEditing: true, editPanel: editor });

      expect(editor.hasUnsavedChanges()).toBe(false);
      expect(await reloadFromServerCommand.handler({}, context)).toMatchObject({ data: { reloaded: true } });
      jest.mocked(reloadKeepingEditMode).mockClear();

      runner.setState({ queries: [{ refId: 'A', expression: '2' }] });
      expect(await reloadFromServerCommand.handler({}, context)).toMatchObject({
        data: { reloaded: false, reason: 'unsaved-changes' },
      });
      expect(runner.state.queries).toEqual([{ refId: 'A', expression: '2' }]);
      expect(reloadKeepingEditMode).not.toHaveBeenCalled();
    }
  );

  it.each(['repeat', 'auto-fit enabled', 'auto-fit disabled', 'show/hide'])(
    'preserves immediate AutoGrid %s changes with pending history before the UI dirty flag',
    async (setting) => {
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries' });
      const item = attachAutoGrid(panel);
      const editor = buildPanelEditScene(panel);
      const history: PendingChangesHistory = {
        record: async () => ({ recorded: true }),
        undo: async () => {},
        redo: async () => {},
        getState: () => ({}),
        subscribe: () => () => {},
      };
      jest.mocked(getPendingChangesHistory).mockReturnValue(history);
      const context = contextFor({ isDirty: true, isEditing: true, editPanel: editor });
      expect(editor.hasUnsavedChanges()).toBe(false);
      item.setState({ isHidden: true });
      expect(editor.hasUnsavedChanges()).toBe(false);
      expect(await reloadFromServerCommand.handler({}, context)).toMatchObject({ data: { reloaded: true } });
      jest.mocked(reloadKeepingEditMode).mockClear();

      if (setting === 'repeat') {
        item.setState({ variableName: 'servers' });
      } else if (setting === 'show/hide') {
        item.state.conditionalRendering?.setState({
          visibility: 'hide',
          conditions: [new ConditionalRenderingData({ value: true, result: undefined })],
        });
      } else {
        item.setState({ fitContent: setting === 'auto-fit enabled' });
      }
      expect(editor.state.isDirty).toBeUndefined();
      expect(await reloadFromServerCommand.handler({}, context)).toMatchObject({
        data: { reloaded: false, reason: 'unsaved-changes' },
      });
      expect(reloadKeepingEditMode).not.toHaveBeenCalled();
    }
  );

  it.each<{ schemaVersion: 'v1' | 'v2'; subtitle: string | undefined }>([
    { schemaVersion: 'v1', subtitle: 'Changed subtitle' },
    { schemaVersion: 'v2', subtitle: 'Changed subtitle' },
    { schemaVersion: 'v1', subtitle: undefined },
    { schemaVersion: 'v2', subtitle: undefined },
  ])('protects only persisted $schemaVersion subtitle-only edits ($subtitle)', async ({ schemaVersion, subtitle }) => {
    const panel = new VizPanel({
      key: 'panel-1',
      pluginId: 'timeseries',
      title: 'Title',
      subtitle: 'Original subtitle',
    });
    const item = new DashboardGridItem({ body: panel });
    const editor = buildPanelEditScene(panel);
    expect(editor.hasUnsavedChanges()).toBe(false);
    const dashboard = new DashboardScene(
      {
        uid: 'abc',
        isEditing: true,
        editPanel: editor,
        body: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [item] }) }),
      },
      schemaVersion
    );
    const saved = dashboard.serializer.getSaveModel(dashboard);
    if ('panels' in saved) {
      expect(saved.panels?.[0]).not.toHaveProperty('subtitle');
    } else {
      expect(saved).toMatchObject({
        elements: { 'panel-1': { kind: 'Panel', spec: { subtitle: 'Original subtitle' } } },
      });
    }
    expect(editor.hasUnsavedChanges()).toBe(false);
    const context = contextFor({ isDirty: false, isEditing: true, editPanel: editor });
    panel.setState({ subtitle });
    expect(editor.hasUnsavedChanges()).toBe(schemaVersion === 'v2');
    expect(await reloadFromServerCommand.handler({}, context)).toMatchObject({
      data: schemaVersion === 'v2' ? { reloaded: false, reason: 'unsaved-changes' } : { reloaded: true },
    });
    if (schemaVersion === 'v2') {
      expect(reloadKeepingEditMode).not.toHaveBeenCalled();
    }
    jest.mocked(reloadKeepingEditMode).mockClear();
    panel.setState({ subtitle: 'Original subtitle' });
    expect(editor.hasUnsavedChanges()).toBe(false);
    expect(await reloadFromServerCommand.handler({}, context)).toMatchObject({ data: { reloaded: true } });
  });

  it('does not treat a library subtitle as persisted content', () => {
    const panel = new VizPanel({
      key: 'panel-1',
      pluginId: 'timeseries',
      subtitle: 'Original subtitle',
      $behaviors: [new LibraryPanelBehavior({ uid: 'lib-uid', name: 'Library panel', isLoaded: true })],
    });
    const item = new DashboardGridItem({ body: panel });
    const editor = buildPanelEditScene(panel);
    const dashboard = new DashboardScene(
      { editPanel: editor, body: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [item] }) }) },
      'v2'
    );
    expect(dashboard.serializer.getSaveModel(dashboard)).toMatchObject({
      elements: { 'panel-1': { kind: 'LibraryPanel' } },
    });
    panel.setState({ subtitle: 'Changed subtitle' });
    expect(editor.hasUnsavedChanges()).toBe(false);
  });

  it.each<{ schemaVersion: 'v1' | 'v2' }>([{ schemaVersion: 'v1' }, { schemaVersion: 'v2' }])(
    'keeps unsaved library queries protected after a $schemaVersion dashboard save',
    async ({ schemaVersion }) => {
      const runner = new SceneQueryRunner({ queries: [{ refId: 'A', expression: '1' }] });
      const panel = new VizPanel({
        key: 'panel-1',
        pluginId: 'timeseries',
        $data: runner,
        $behaviors: [new LibraryPanelBehavior({ uid: 'lib-uid', name: 'Library panel', isLoaded: true })],
      });
      const item = new DashboardGridItem({ body: panel });
      const editor = buildPanelEditScene(panel);
      new DashboardScene(
        {
          editPanel: editor,
          body: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [item] }) }),
        },
        schemaVersion
      );
      runner.setState({ queries: [{ refId: 'A', expression: '2' }] });
      editor.dashboardSaved();
      expect(editor.hasUnsavedChanges()).toBe(true);
      expect(editor.state.isDirty).toBe(true);
      expect(
        await reloadFromServerCommand.handler({}, contextFor({ isDirty: false, isEditing: true, editPanel: editor }))
      ).toMatchObject({ data: { reloaded: false, reason: 'unsaved-changes' } });
      expect(runner.state.queries).toEqual([{ refId: 'A', expression: '2' }]);
      expect(reloadKeepingEditMode).not.toHaveBeenCalled();
    }
  );

  it('reports unsaved changes in the open scene instead of discarding them', async () => {
    const result = await reloadFromServerCommand.handler({}, contextFor({ isDirty: true, isEditing: true }));

    expect(result.data).toEqual({ reloaded: false, reason: 'unsaved-changes' });
    expect(reloadKeepingEditMode).not.toHaveBeenCalled();
  });

  it('reloads pending changes whose plugin keeps their history, still editing: every edit was recorded', async () => {
    jest.mocked(getPendingChangesHistory).mockReturnValue({} as PendingChangesHistory);

    const result = await reloadFromServerCommand.handler({}, contextFor({ isDirty: true, isEditing: true }));

    expect(result.data).toEqual({ reloaded: true });
    expect(reloadKeepingEditMode).toHaveBeenCalledWith('abc', true);
  });

  // Reloading would drop it: recording cleared isDirty before the plugin failed to keep it.
  it('keeps an edit the plugin failed to record, reporting it as unsaved', async () => {
    jest.mocked(getPendingChangesHistory).mockReturnValue({} as PendingChangesHistory);
    jest.mocked(hasUnrecordedPendingChange).mockReturnValueOnce(true);

    const result = await reloadFromServerCommand.handler({}, contextFor({ isDirty: false, isEditing: true }));

    expect(result.data).toEqual({ reloaded: false, reason: 'unsaved-changes' });
    expect(reloadKeepingEditMode).not.toHaveBeenCalled();
  });
});
