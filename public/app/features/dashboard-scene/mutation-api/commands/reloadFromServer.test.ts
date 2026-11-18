import { SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { getPendingChangesHistory, type PendingChangesHistory } from '../../lifecycle/pendingChangePreview';
import { hasUnrecordedPendingChange, reloadKeepingEditMode } from '../../lifecycle/pendingChangesHistory';
import { buildPanelEditScene } from '../../panel-edit/PanelEditor';
import { type DashboardScene } from '../../scene/DashboardScene';
import { LibraryPanelBehavior } from '../../scene/LibraryPanelBehavior';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';

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
        new AutoGridItem({ body: panel });
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
