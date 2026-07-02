import { type Variable, type VariableSpec } from 'app/api/clients/dashboard/v2beta1';
import { AnnoKeyFolder } from 'app/features/apiserver/types';

import { bulkDeleteVariables, bulkMoveVariables } from './api';

const postMock = jest.fn();
const deleteMock = jest.fn();

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
});

describe('bulkDeleteVariables', () => {
  it('deletes each variable and reports the count', async () => {
    const result = await bulkDeleteVariables([makeVariable('a'), makeVariable('b', 'folder-1')]);

    expect(deleteMock).toHaveBeenCalledTimes(2);
    expect(deleteMock.mock.calls[0][0]).toContain('/variables/a');
    expect(deleteMock.mock.calls[1][0]).toContain('/variables/b--folder-1');
    expect(result).toEqual({ succeeded: 2, failed: [] });
  });

  it('reports partial failures and continues', async () => {
    deleteMock.mockRejectedValueOnce(new Error('boom'));

    const result = await bulkDeleteVariables([makeVariable('a'), makeVariable('b')]);

    expect(result.succeeded).toBe(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].name).toBe('a');
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
    expect(result).toEqual({ succeeded: 1, failed: [] });
  });

  it('moves a folder-scoped variable to global by omitting the annotation', async () => {
    await bulkMoveVariables([makeVariable('a', 'folder-1')], undefined);

    expect(postMock).toHaveBeenCalledWith(
      expect.stringContaining('/variables'),
      expect.objectContaining({ metadata: {} }),
      expect.anything()
    );
  });

  it('skips variables already in the target scope', async () => {
    const result = await bulkMoveVariables([makeVariable('a', 'folder-1')], 'folder-1');

    expect(postMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
    expect(result.succeeded).toBe(1);
  });

  it('does not delete the original when the create fails', async () => {
    postMock.mockRejectedValueOnce(new Error('conflict'));

    const result = await bulkMoveVariables([makeVariable('a')], 'folder-1');

    expect(deleteMock).not.toHaveBeenCalled();
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].name).toBe('a');
  });
});
