import { act, renderHook } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';

import { QueryFlowNodeKind, type QueryFlowNode } from '../model/types';

import { useEditorHighlight } from './useEditorHighlight';

interface FakeEditor {
  getDomNode: () => HTMLElement | undefined;
  getModel: () => { getValue: () => string } | null;
  createDecorationsCollection: jest.Mock;
}

let fakeEditors: FakeEditor[] = [];

jest.mock('monaco-editor', () => ({
  editor: {
    getEditors: () => fakeEditors,
  },
}));

function makeFakeEditor(domNode: HTMLElement | undefined, value: string | null): FakeEditor {
  return {
    getDomNode: () => domNode,
    getModel: () => (value === null ? null : { getValue: () => value }),
    createDecorationsCollection: jest.fn(() => ({ clear: jest.fn() })),
  };
}

function makeNode(from: number, to: number): QueryFlowNode {
  return {
    id: `n:${from}-${to}`,
    kind: QueryFlowNodeKind.Selector,
    language: 'promql',
    label: 'x',
    span: { from, to },
    childIds: [],
  };
}

describe('useEditorHighlight', () => {
  afterEach(() => {
    fakeEditors = [];
    document.body.innerHTML = '';
  });

  it('picks the editor whose row DOM matches this refId, even when both rows share identical text', async () => {
    document.body.innerHTML = `
      <div data-testid="${selectors.components.QueryEditorRows.rows}">
        <div data-testid="${selectors.components.QueryEditorRow.title('A')}"></div>
        <div id="editor-a"></div>
      </div>
      <div data-testid="${selectors.components.QueryEditorRows.rows}">
        <div data-testid="${selectors.components.QueryEditorRow.title('B')}"></div>
        <div id="editor-b"></div>
      </div>
    `;
    const editorA = makeFakeEditor(document.getElementById('editor-a')!, 'metric{job="api"}');
    const editorB = makeFakeEditor(document.getElementById('editor-b')!, 'metric{job="api"}');
    fakeEditors = [editorA, editorB];

    const { result } = renderHook(() => useEditorHighlight({ expr: 'metric{job="api"}', refId: 'B' }));

    await act(async () => {
      result.current(makeNode(0, 6));
      await Promise.resolve();
    });

    expect(editorA.createDecorationsCollection).not.toHaveBeenCalled();
    expect(editorB.createDecorationsCollection).toHaveBeenCalledTimes(1);
  });

  it('falls back to matching by model text when no row DOM container is found for the refId', async () => {
    // No "Query editor row" markup in the DOM at all — simulates a datasource that doesn't mount
    // through the standard row structure, or hasn't rendered yet.
    const editor = makeFakeEditor(document.createElement('div'), 'metric{job="api"}');
    fakeEditors = [editor];

    const { result } = renderHook(() => useEditorHighlight({ expr: 'metric{job="api"}', refId: 'A' }));

    await act(async () => {
      result.current(makeNode(0, 6));
      await Promise.resolve();
    });

    expect(editor.createDecorationsCollection).toHaveBeenCalledTimes(1);
  });

  it('does not decorate anything when neither DOM lookup nor text match find an editor', async () => {
    const editor = makeFakeEditor(document.createElement('div'), 'a different query');
    fakeEditors = [editor];

    const { result } = renderHook(() => useEditorHighlight({ expr: 'metric{job="api"}', refId: 'A' }));

    await act(async () => {
      result.current(makeNode(0, 6));
      await Promise.resolve();
    });

    expect(editor.createDecorationsCollection).not.toHaveBeenCalled();
  });

  it('clears the previous decoration collection when called again or with undefined', async () => {
    document.body.innerHTML = `
      <div data-testid="${selectors.components.QueryEditorRows.rows}">
        <div data-testid="${selectors.components.QueryEditorRow.title('A')}"></div>
        <div id="editor-a"></div>
      </div>
    `;
    const collectionA = { clear: jest.fn() };
    const editor: FakeEditor = {
      getDomNode: () => document.getElementById('editor-a')!,
      getModel: () => ({ getValue: () => 'metric{job="api"}' }),
      createDecorationsCollection: jest.fn(() => collectionA),
    };
    fakeEditors = [editor];

    const { result } = renderHook(() => useEditorHighlight({ expr: 'metric{job="api"}', refId: 'A' }));

    await act(async () => {
      result.current(makeNode(0, 6));
      await Promise.resolve();
    });
    expect(editor.createDecorationsCollection).toHaveBeenCalledTimes(1);

    act(() => {
      result.current(undefined);
    });
    expect(collectionA.clear).toHaveBeenCalledTimes(1);
  });
});
