import { type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type Variable, type VariableSpec } from 'app/api/clients/dashboard/v2beta1';
import { AnnoKeyFolder } from 'app/features/apiserver/types';

import { bulkDeleteVariables, bulkMoveVariables, recreateVariable } from './api';

const postMock = jest.fn();
const deleteMock = jest.fn();
const clearPredefinedVariablesCacheMock = jest.fn();
const clearSceneCacheMock = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    post: postMock,
    delete: deleteMock,
  }),
}));

jest.mock('app/store/store', () => ({
  dispatch: jest.fn(),
}));

jest.mock('app/features/dashboard-scene/utils/predefinedVariables', () => ({
  clearPredefinedVariablesCache: (...args: unknown[]) => clearPredefinedVariablesCacheMock(...args),
}));

jest.mock('app/features/dashboard-scene/pages/DashboardScenePageStateManager', () => ({
  getDashboardScenePageStateManager: () => ({
    clearSceneCache: (...args: unknown[]) => clearSceneCacheMock(...args),
  }),
}));

function makeVariable(specName: string, folderUid?: string): Variable {
  return {
    metadata: {
      name: folderUid ? `${specName}--${folderUid}` : specName,
      ...(folderUid && { annotations: { [AnnoKeyFolder]: folderUid } }),
    },
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    spec: {
      kind: 'CustomVariable',
      spec: { name: specName, query: 'a,b' },
    } as unknown as VariableSpec,
  };
}

beforeEach(() => {
  postMock.mockReset().mockResolvedValue({});
  deleteMock.mockReset().mockResolvedValue({});
  clearPredefinedVariablesCacheMock.mockReset();
  clearSceneCacheMock.mockReset();
});

function expectCachesInvalidated() {
  expect(clearPredefinedVariablesCacheMock).toHaveBeenCalledTimes(1);
  expect(clearSceneCacheMock).toHaveBeenCalledTimes(1);
}

function expectCachesNotInvalidated() {
  expect(clearPredefinedVariablesCacheMock).not.toHaveBeenCalled();
  expect(clearSceneCacheMock).not.toHaveBeenCalled();
}

describe('bulkDeleteVariables', () => {
  it('deletes each variable and reports the count', async () => {
    const result = await bulkDeleteVariables([makeVariable('a'), makeVariable('b', 'folder-1')]);

    expect(deleteMock).toHaveBeenCalledTimes(2);
    expect(deleteMock.mock.calls[0][0]).toContain('/variables/a');
    expect(deleteMock.mock.calls[1][0]).toContain('/variables/b--folder-1');
    expect(result).toEqual({ succeeded: 2, skipped: 0, failed: [] });
    expectCachesInvalidated();
  });

  it('reports partial failures and continues', async () => {
    deleteMock.mockRejectedValueOnce(new Error('boom'));

    const result = await bulkDeleteVariables([makeVariable('a'), makeVariable('b')]);

    expect(result.succeeded).toBe(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].name).toBe('a');
    expect(result.failed[0].metadataName).toBe('a');
  });
});

describe('bulkMoveVariables', () => {
  it('creates the copy in the target scope before deleting the original', async () => {
    const calls: string[] = [];
    postMock.mockImplementation(async () => calls.push('create'));
    deleteMock.mockImplementation(async () => calls.push('delete'));

    const result = await bulkMoveVariables([makeVariable('a')], 'folder-1');

    expect(calls).toEqual(['create', 'delete']);
    expect(postMock).toHaveBeenCalledWith(
      expect.stringContaining('/variables'),
      expect.objectContaining({
        metadata: { annotations: { [AnnoKeyFolder]: 'folder-1' } },
      }),
      expect.anything()
    );
    expect(result).toEqual({ succeeded: 1, skipped: 0, failed: [] });
  });

  it('moves a folder-scoped variable to global by omitting the annotation', async () => {
    await bulkMoveVariables([makeVariable('a', 'folder-1')], undefined);

    expect(postMock).toHaveBeenCalledWith(
      expect.stringContaining('/variables'),
      expect.objectContaining({ metadata: {} }),
      expect.anything()
    );
  });

  it('reports variables already in the target scope as skipped, not moved', async () => {
    const result = await bulkMoveVariables([makeVariable('a', 'folder-1')], 'folder-1');

    expect(postMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
    expect(result).toEqual({ succeeded: 0, skipped: 1, failed: [] });
  });

  it('does not delete the original when the create fails', async () => {
    postMock.mockRejectedValueOnce(new Error('conflict'));

    const result = await bulkMoveVariables([makeVariable('a')], 'folder-1');

    expect(deleteMock).not.toHaveBeenCalled();
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].name).toBe('a');
  });

  it('warns without counting failed when create succeeds but delete fails', async () => {
    deleteMock.mockRejectedValueOnce(new Error('boom'));

    const result = await bulkMoveVariables([makeVariable('a')], 'folder-1');

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledTimes(1);
    // Not failed (retry would conflict) and not succeeded (original remains).
    expect(result).toEqual({ succeeded: 0, skipped: 0, failed: [] });
  });
});

describe('recreateVariable', () => {
  const kind: VariableKind = getKind(makeVariable('a'));

  function getKind(variable: Variable): VariableKind {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return variable.spec as unknown as VariableKind;
  }

  it('creates the copy before deleting the original and reports full success', async () => {
    const calls: string[] = [];
    postMock.mockImplementation(async () => calls.push('create'));
    deleteMock.mockImplementation(async () => calls.push('delete'));

    const result = await recreateVariable('a', kind, 'folder-1');

    expect(calls).toEqual(['create', 'delete']);
    expect(result).toEqual({ deletedOriginal: true });
    expectCachesInvalidated();
  });

  it('propagates a create failure without deleting the original', async () => {
    postMock.mockRejectedValueOnce(new Error('conflict'));

    await expect(recreateVariable('a', kind, 'folder-1')).rejects.toThrow('conflict');
    expect(deleteMock).not.toHaveBeenCalled();
    expectCachesNotInvalidated();
  });

  it('reports a delete failure without throwing, since the copy already exists', async () => {
    deleteMock.mockRejectedValueOnce(new Error('boom'));

    const result = await recreateVariable('a', kind, 'folder-1');

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ deletedOriginal: false });
    // Copy exists — caches must refresh even when the original could not be removed.
    expectCachesInvalidated();
  });
});
