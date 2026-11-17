import { getPendingChangesHistory, type PendingChangesHistory } from '../../lifecycle/pendingChangePreview';
import { hasUnrecordedPendingChange, reloadKeepingEditMode } from '../../lifecycle/pendingChangesHistory';
import { type DashboardScene } from '../../scene/DashboardScene';

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

function contextFor(state: { isDirty: boolean; isEditing: boolean }): MutationContext {
  return { scene: { state: { uid: 'abc', meta: {}, ...state } } as unknown as DashboardScene } as MutationContext;
}

describe('RELOAD_FROM_SERVER', () => {
  beforeEach(() => jest.clearAllMocks());

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
