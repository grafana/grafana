import { getPendingChangesHistory, type PendingChangesHistory } from '../../lifecycle/pendingChangePreview';
import { reloadKeepingEditMode } from '../../lifecycle/pendingChangesHistory';
import { type DashboardScene } from '../../scene/DashboardScene';

import { reloadFromServerCommand } from './reloadFromServer';
import { type MutationContext } from './types';

jest.mock('../../lifecycle/pendingChangePreview', () => ({
  ...jest.requireActual('../../lifecycle/pendingChangePreview'),
  getPendingChangesHistory: jest.fn(),
}));
jest.mock('../../lifecycle/pendingChangesHistory', () => ({ reloadKeepingEditMode: jest.fn() }));

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
});
