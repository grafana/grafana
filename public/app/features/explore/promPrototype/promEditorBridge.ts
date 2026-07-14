// Prototype-only bridge to the active PromQL Monaco editor.
// The Prometheus query editor lives in the external @grafana/prometheus package,
// so we don't own its props. Instead, we locate the editor imperatively at
// interaction time by asking Monaco for all editors with languageId === 'promql'.
//
// This is intentionally hacky — good enough for a prototype demo, not shippable.

import type * as MonacoType from 'monaco-editor';

// Fetch the globally-registered monaco instance (grafana's Monaco lazy-loads it).
function getMonaco(): typeof MonacoType | null {
  // Grafana exposes monaco via window.monaco once the promql editor mounts.
  const win = window as unknown as { monaco?: typeof MonacoType };
  return win.monaco ?? null;
}

function findPromqlEditor(): MonacoType.editor.ICodeEditor | null {
  const monaco = getMonaco();
  if (!monaco) {
    return null;
  }
  const editors = monaco.editor.getEditors();
  for (const editor of editors) {
    const model = editor.getModel();
    if (model && model.getLanguageId() === 'promql') {
      return editor;
    }
  }
  return null;
}

// Returns the DOM node of the active PromQL editor, or null if none is mounted.
export function findPromqlEditorDomNode(): HTMLElement | null {
  const editor = findPromqlEditor();
  return (editor?.getContainerDomNode() as HTMLElement | undefined) ?? null;
}

export interface EditorSnapshot {
  text: string;
  cursor: number; // char offset in the model
}

export function getEditorSnapshot(): EditorSnapshot | null {
  const editor = findPromqlEditor();
  if (!editor) {
    return null;
  }
  const model = editor.getModel();
  if (!model) {
    return null;
  }
  const pos = editor.getPosition();
  const text = model.getValue();
  const cursor = pos ? model.getOffsetAt(pos) : text.length;
  return { text, cursor };
}

// Replace the editor value entirely. Used for "new query" or "replace metric" flows.
export function replaceEditorText(next: string, cursorAtEnd = true): boolean {
  const editor = findPromqlEditor();
  if (!editor) {
    return false;
  }
  const model = editor.getModel();
  if (!model) {
    return false;
  }
  editor.pushUndoStop();
  editor.executeEdits('prom-prototype', [
    {
      range: model.getFullModelRange(),
      text: next,
      forceMoveMarkers: true,
    },
  ]);
  editor.pushUndoStop();
  if (cursorAtEnd) {
    const end = model.getPositionAt(next.length);
    editor.setPosition(end);
  }
  editor.focus();
  return true;
}

// Insert text at the current cursor position and place the cursor after the insert.
export function insertAtCursorWithNewCursor(nextText: string, nextCursor: number): boolean {
  return replaceEditorText(nextText, false) && setCursorOffset(nextCursor);
}

export function setCursorOffset(offset: number): boolean {
  const editor = findPromqlEditor();
  if (!editor) {
    return false;
  }
  const model = editor.getModel();
  if (!model) {
    return false;
  }
  const pos = model.getPositionAt(offset);
  editor.setPosition(pos);
  editor.focus();
  return true;
}

// Register a listener for changes to the editor's SELECTED text. Fires with
// the trimmed selection contents each time the selection changes. Empty
// selections still fire (cb receives ''). Polls for the editor on mount.
export function subscribeToEditorSelection(cb: (selectedText: string) => void): () => void {
  let disposables: MonacoType.IDisposable[] = [];
  let attached = false;
  let cancelled = false;

  const attach = (editor: MonacoType.editor.ICodeEditor) => {
    attached = true;
    const model = editor.getModel();
    disposables.push(
      editor.onDidChangeCursorSelection(() => {
        if (!model) {
          cb('');
          return;
        }
        const selection = editor.getSelection();
        if (!selection) {
          cb('');
          return;
        }
        cb(model.getValueInRange(selection).trim());
      })
    );
  };

  const tryAttach = () => {
    if (cancelled || attached) {
      return;
    }
    const editor = findPromqlEditor();
    if (editor) {
      attach(editor);
    } else {
      window.setTimeout(tryAttach, 300);
    }
  };
  tryAttach();

  return () => {
    cancelled = true;
    disposables.forEach((d) => d.dispose());
    disposables = [];
  };
}

// Register a listener for editor focus/blur. Returns an unsubscribe fn.
// Polls until the promql editor is available, then hooks its focus events.
export function subscribeToEditorFocus(cb: (focused: boolean) => void): () => void {
  let disposables: MonacoType.IDisposable[] = [];
  let attached = false;
  let cancelled = false;

  const attach = (editor: MonacoType.editor.ICodeEditor) => {
    attached = true;
    disposables.push(editor.onDidFocusEditorWidget(() => cb(true)));
    disposables.push(editor.onDidBlurEditorWidget(() => cb(false)));
    // Also fire once with initial state.
    cb(editor.hasWidgetFocus());
  };

  const tryAttach = () => {
    if (cancelled || attached) {
      return;
    }
    const editor = findPromqlEditor();
    if (editor) {
      attach(editor);
    } else {
      window.setTimeout(tryAttach, 300);
    }
  };
  tryAttach();

  return () => {
    cancelled = true;
    disposables.forEach((d) => d.dispose());
    disposables = [];
  };
}

// Register a listener for content or cursor changes. Returns an unsubscribe fn.
// Polls for the editor on mount because the promql editor may mount after our rail.
export function subscribeToEditor(cb: (snap: EditorSnapshot) => void): () => void {
  let disposables: MonacoType.IDisposable[] = [];
  let attached = false;
  let cancelled = false;

  const attach = (editor: MonacoType.editor.ICodeEditor) => {
    attached = true;
    const model = editor.getModel();
    if (model) {
      disposables.push(
        model.onDidChangeContent(() => {
          const snap = getEditorSnapshot();
          if (snap) {
            cb(snap);
          }
        })
      );
    }
    disposables.push(
      editor.onDidChangeCursorPosition(() => {
        const snap = getEditorSnapshot();
        if (snap) {
          cb(snap);
        }
      })
    );
    // Fire once so subscribers get initial state.
    const snap = getEditorSnapshot();
    if (snap) {
      cb(snap);
    }
  };

  const tryAttach = () => {
    if (cancelled || attached) {
      return;
    }
    const editor = findPromqlEditor();
    if (editor) {
      attach(editor);
    } else {
      window.setTimeout(tryAttach, 300);
    }
  };
  tryAttach();

  return () => {
    cancelled = true;
    disposables.forEach((d) => d.dispose());
    disposables = [];
  };
}
