import { css } from '@emotion/css';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { type GrafanaTheme2, ThemeContext } from '@grafana/data';

import { type MonacoEditor, type Monaco, type monacoTypes } from '../types';

import { CaretPopover } from './CaretPopover';
import { PasteActions } from './PasteActions';
import { type EditorActions, Journey } from './types';

/** Minimum inserted length to treat a content change / paste as a "paste". */
const PASTE_THRESHOLD = 20;

/** Applied to the temporary (not-yet-accepted) query so it reads as a preview. */
const previewClass = css({ opacity: 0.45 });

export interface Disposable {
  dispose(): void;
}

/**
 * Attaches the PromQL co-authoring prototype to a Monaco editor instance:
 *  - `/` then `space` opens a caret-anchored assistant popover (journeys 1 & 2).
 *  - Generated queries are written as a semi-transparent preview the user
 *    accepts (Enter / button), refines (NL input), or edits (highlight text).
 *  - Pasting a query shows subtle non-AI "Explain / Visualize" actions (journey 3).
 * Returns a Disposable that tears down every listener, widget, and React root.
 */
export function attachPromQLCoauthor(editor: MonacoEditor, monaco: Monaco, theme: GrafanaTheme2): Disposable {
  const disposables: monacoTypes.IDisposable[] = [];
  const popover = new CaretPopover(editor, theme);

  // Gates our Enter/Escape keybindings so they only fire while the popover is
  // open — otherwise Enter behaves normally (newline / run) in the editor.
  const popoverOpenKey = editor.createContextKey<boolean>('promqlCoauthorPopoverOpen', false);

  // Re-entrancy guard: our own edits must not re-trigger detection.
  let suppressing = false;

  // Temporary-preview state.
  let tempActive = false;
  let tempDecorations: string[] = [];
  let preTempContent = '';

  const replaceAll = (text: string) => {
    const model = editor.getModel();
    if (!model) {
      return;
    }
    suppressing = true;
    editor.executeEdits('promql-coauthor', [{ range: model.getFullModelRange(), text }]);
    editor.pushUndoStop();
    suppressing = false;
  };

  // The Prom field only calls onChange on blur/run. Re-focus then blur on the
  // next tick so onDidBlurEditorWidget fires with the current (inserted) value.
  const commitToExplore = () => {
    editor.focus();
    const textarea = editor.getDomNode()?.querySelector('textarea');
    setTimeout(() => textarea?.blur(), 0);
  };

  const actions: EditorActions = {
    writeTemp(query) {
      const model = editor.getModel();
      if (!model) {
        return;
      }
      preTempContent = model.getValue();
      replaceAll(query);
      tempDecorations = editor.deltaDecorations(tempDecorations, [
        { range: model.getFullModelRange(), options: { inlineClassName: previewClass } },
      ]);
      tempActive = true;
      popover.reposition();
    },
    clearTemp() {
      replaceAll(preTempContent);
      tempDecorations = editor.deltaDecorations(tempDecorations, []);
      tempActive = false;
    },
    commitTemp() {
      tempDecorations = editor.deltaDecorations(tempDecorations, []);
      tempActive = false;
      commitToExplore();
    },
    insert(query) {
      replaceAll(query);
      popover.hide();
      commitToExplore();
    },
  };

  const closePopover = () => {
    popoverOpenKey.set(false);
    popover.hide();
    editor.focus();
  };

  const openPopover = (journey?: Journey) => {
    hidePasteActions();
    // Close Monaco's autocomplete/suggest widget so it doesn't overlap the popover.
    editor.trigger('promql-coauthor', 'hideSuggestWidget', {});
    const j = journey ?? (editor.getModel()?.getValue().trim() ? Journey.MidQuery : Journey.Scratch);
    popoverOpenKey.set(true);
    popover.show(j, actions, closePopover);
  };

  // Enter accepts a previewed query; Escape dismisses. Registered as
  // context-gated keybindings so they intercept the key before Monaco types it
  // (a plain onKeyDown preventDefault doesn't reliably stop the newline).
  editor.addCommand(
    monaco.KeyCode.Enter,
    () => {
      if (tempActive) {
        actions.commitTemp();
      }
      closePopover();
    },
    'promqlCoauthorPopoverOpen'
  );
  editor.addCommand(
    monaco.KeyCode.Escape,
    () => {
      if (tempActive) {
        actions.clearTemp();
      }
      closePopover();
    },
    'promqlCoauthorPopoverOpen'
  );

  // --- Trigger detection: "/" then " " -----------------------------------
  disposables.push(
    editor.onDidChangeModelContent((e) => {
      if (suppressing) {
        return;
      }
      const change = e.changes.length === 1 ? e.changes[0] : undefined;

      // Paste fallback (onDidPaste is primary, below).
      if (change && change.text.length >= PASTE_THRESHOLD) {
        showPasteActions();
        return;
      }

      // "/ " trigger.
      if (!change || change.text !== ' ') {
        return;
      }
      const pos = editor.getPosition();
      const model = editor.getModel();
      if (!pos || !model || pos.column < 3) {
        return;
      }
      const startCol = pos.column - 2;
      const before = model.getValueInRange(new monaco.Range(pos.lineNumber, startCol, pos.lineNumber, pos.column));
      if (before !== '/ ') {
        return;
      }
      // Strip the "/ " so it never pollutes the query, then open at the caret.
      suppressing = true;
      editor.executeEdits('promql-coauthor', [
        { range: new monaco.Range(pos.lineNumber, startCol, pos.lineNumber, pos.column), text: '' },
      ]);
      suppressing = false;
      openPopover();
    })
  );

  // Keep the popover glued to the caret.
  disposables.push(editor.onDidChangeCursorPosition(() => popover.reposition()));
  disposables.push(editor.onDidScrollChange(() => popover.reposition()));

  // Highlighting part of the temporary query accepts it and drops into edit mode.
  disposables.push(
    editor.onDidChangeCursorSelection((e) => {
      if (suppressing || !tempActive || e.selection.isEmpty()) {
        return;
      }
      actions.commitTemp();
      openPopover(Journey.Edit);
    })
  );

  // The popover is portalled with fixed positioning, so page scroll/resize can
  // shift the caret's screen coordinates — re-anchor on both.
  const onWindowReflow = () => popover.reposition();
  window.addEventListener('scroll', onWindowReflow, true);
  window.addEventListener('resize', onWindowReflow);

  // --- Paste detection (journey 3) ---------------------------------------
  disposables.push(
    editor.onDidPaste((e) => {
      if (suppressing) {
        return;
      }
      const text = editor.getModel()?.getValueInRange(e.range) ?? '';
      if (text.trim().length >= PASTE_THRESHOLD) {
        showPasteActions();
      }
    })
  );

  // --- Paste-actions overlay widget --------------------------------------
  let pasteRoot: Root | undefined;
  let pasteWidget: monacoTypes.editor.IOverlayWidget | undefined;

  function showPasteActions() {
    if (pasteWidget) {
      return;
    }
    const dom = document.createElement('div');
    pasteRoot = createRoot(dom);
    pasteWidget = {
      getId: () => 'promql.coauthor.pasteactions',
      getDomNode: () => dom,
      getPosition: () => ({
        preference: monaco.editor.OverlayWidgetPositionPreference.TOP_RIGHT_CORNER,
      }),
    };
    editor.addOverlayWidget(pasteWidget);
    pasteRoot.render(
      createElement(
        ThemeContext.Provider,
        { value: theme },
        createElement(PasteActions, {
          getEditorRect: () => editor.getContainerDomNode().getBoundingClientRect(),
          onDismiss: hidePasteActions,
        })
      )
    );
  }

  function hidePasteActions() {
    if (pasteWidget) {
      editor.removeOverlayWidget(pasteWidget);
      pasteWidget = undefined;
    }
    if (pasteRoot) {
      const root = pasteRoot;
      pasteRoot = undefined;
      setTimeout(() => root.unmount(), 0);
    }
  }

  return {
    dispose() {
      window.removeEventListener('scroll', onWindowReflow, true);
      window.removeEventListener('resize', onWindowReflow);
      disposables.forEach((d) => d.dispose());
      popover.dispose();
      hidePasteActions();
    },
  };
}
