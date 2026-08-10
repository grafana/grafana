import { act, renderHook, waitFor } from '@testing-library/react';

import { newNotebookSpec, setNotebookTitle } from '../model/notebookSpec';

import { useNotebookEditorState } from './useNotebookEditorState';

const mockFetchNotebook = jest.fn();
const mockSaveNotebook = jest.fn();

jest.mock('../api/notebookAPI', () => ({
  fetchNotebook: (uid: string) => mockFetchNotebook(uid),
  saveNotebook: (resource: unknown) => mockSaveNotebook(resource),
  isConflictError: () => false,
}));

function resourceWithTitle(title: string) {
  return {
    apiVersion: 'dashboard.grafana.app/v2beta1',
    kind: 'Notebook',
    metadata: { name: 'nb-1', resourceVersion: '1', creationTimestamp: '' },
    spec: newNotebookSpec(title),
  };
}

describe('useNotebookEditorState undo/redo', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFetchNotebook.mockResolvedValue(resourceWithTitle('original'));
    mockSaveNotebook.mockImplementation(async (resource) => resource);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  async function renderLoaded() {
    const hook = renderHook(() => useNotebookEditorState('nb-1'));
    await waitFor(() => expect(hook.result.current.state.loading).toBe(false));
    return hook;
  }

  it('undoes and redoes local edits', async () => {
    const { result } = await renderLoaded();
    expect(result.current.state.canUndo).toBe(false);

    act(() => {
      result.current.updateSpec((s) => setNotebookTitle(s, 'first'));
    });
    act(() => {
      jest.advanceTimersByTime(1000); // beyond the coalesce window
      result.current.updateSpec((s) => setNotebookTitle(s, 'second'));
    });

    expect(result.current.state.spec?.title).toBe('second');
    expect(result.current.state.canUndo).toBe(true);
    expect(result.current.state.canRedo).toBe(false);

    act(() => {
      expect(result.current.undo()).toBe(true);
    });
    expect(result.current.state.spec?.title).toBe('first');
    expect(result.current.state.canRedo).toBe(true);

    act(() => {
      expect(result.current.undo()).toBe(true);
    });
    expect(result.current.state.spec?.title).toBe('original');
    expect(result.current.state.canUndo).toBe(false);

    act(() => {
      expect(result.current.undo()).toBe(false);
    });

    act(() => {
      expect(result.current.redo()).toBe(true);
    });
    expect(result.current.state.spec?.title).toBe('first');

    act(() => {
      expect(result.current.redo()).toBe(true);
    });
    expect(result.current.state.spec?.title).toBe('second');
    expect(result.current.state.canRedo).toBe(false);
  });

  it('coalesces rapid edits into one undo step', async () => {
    const { result } = await renderLoaded();

    // Simulates typing: several updates within the coalesce window.
    act(() => {
      result.current.updateSpec((s) => setNotebookTitle(s, 'a'));
      jest.advanceTimersByTime(100);
      result.current.updateSpec((s) => setNotebookTitle(s, 'ab'));
      jest.advanceTimersByTime(100);
      result.current.updateSpec((s) => setNotebookTitle(s, 'abc'));
    });

    act(() => {
      expect(result.current.undo()).toBe(true);
    });
    expect(result.current.state.spec?.title).toBe('original');
    expect(result.current.state.canUndo).toBe(false);
  });

  it('a new edit after undo clears the redo stack', async () => {
    const { result } = await renderLoaded();

    act(() => {
      result.current.updateSpec((s) => setNotebookTitle(s, 'first'));
    });
    act(() => {
      expect(result.current.undo()).toBe(true);
    });
    expect(result.current.state.canRedo).toBe(true);

    act(() => {
      result.current.updateSpec((s) => setNotebookTitle(s, 'branched'));
    });
    expect(result.current.state.canRedo).toBe(false);
    expect(result.current.redo()).toBe(false);
    expect(result.current.state.spec?.title).toBe('branched');
  });
});
