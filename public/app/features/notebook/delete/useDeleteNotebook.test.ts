import { getWrapper, renderHook } from 'test/test-utils';

import { useDeleteNotebookMutation } from 'app/api/clients/dashboard/v2beta1';

import { notebookAnalytics } from '../analytics/main';
import { NOTEBOOK_DELETE_SOURCE, type NotebookDeleteSource } from '../analytics/types';

import { useDeleteNotebook } from './useDeleteNotebook';

// Only the write is stubbed.
jest.mock('app/api/clients/dashboard/v2beta1', () => ({
  useDeleteNotebookMutation: jest.fn(),
}));

jest.mock('../analytics/main', () => ({ notebookAnalytics: { deleted: jest.fn() } }));

const mockUseDeleteNotebookMutation = jest.mocked(useDeleteNotebookMutation);

/** The toasts dispatch for real, so the hook needs the store around it. */
function setupHook(source: NotebookDeleteSource) {
  const wrapper = getWrapper({ renderWithRouter: false });
  return renderHook(() => useDeleteNotebook(source), { wrapper });
}

/** Stands in for the delete mutation hook. The hook awaits its result through `.unwrap()`. */
function setupDelete(unwrap: () => Promise<unknown> = async () => ({})) {
  const trigger = jest.fn().mockReturnValue({ unwrap });
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only the trigger and isLoading are used
  mockUseDeleteNotebookMutation.mockReturnValue([trigger, { isLoading: false }] as unknown as ReturnType<
    typeof useDeleteNotebookMutation
  >);

  return trigger;
}

describe('useDeleteNotebook', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports the delete with the surface it was confirmed from', async () => {
    setupDelete();
    const { result } = setupHook(NOTEBOOK_DELETE_SOURCE.NOTEBOOK_LIST);

    await expect(result.current.remove('nb1', 'Q2 latency regression')).resolves.toBe(true);

    expect(notebookAnalytics.deleted).toHaveBeenCalledTimes(1);
    expect(notebookAnalytics.deleted).toHaveBeenCalledWith('nb1', 'notebook_list');
  });

  it('reports the notebook surface when the delete came from the notebook itself', async () => {
    setupDelete();
    const { result } = setupHook(NOTEBOOK_DELETE_SOURCE.NOTEBOOK_TOOLBAR);

    await result.current.remove('nb1', 'Q2 latency regression');

    expect(notebookAnalytics.deleted).toHaveBeenCalledWith('nb1', 'notebook_toolbar');
  });

  it('reports nothing when the delete fails', async () => {
    setupDelete(() => Promise.reject(new Error('apiserver said no')));
    const { result } = setupHook(NOTEBOOK_DELETE_SOURCE.NOTEBOOK_LIST);

    await expect(result.current.remove('nb1', 'Q2 latency regression')).resolves.toBe(false);

    expect(notebookAnalytics.deleted).not.toHaveBeenCalled();
  });
});
