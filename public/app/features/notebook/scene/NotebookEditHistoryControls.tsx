import { css } from '@emotion/css';
import { useEffect } from 'react';

import { t } from '@grafana/i18n';
import { IconButton, Stack } from '@grafana/ui';

import { type NotebookEditHistory } from './NotebookEditHistory';

export function NotebookEditHistoryControls({ history }: { history: NotebookEditHistory }) {
  const { canUndo, canRedo, undoLabel, redoLabel } = history.useState();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || (!event.metaKey && !event.ctrlKey) || browserOwnsUndo(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      const isUndo = key === 'z' && !event.shiftKey;
      const isRedo = (key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey);
      if (!isUndo && !isRedo) {
        return;
      }

      // Always stop the key press here, even when there is nothing to undo. Code cells turn off
      // CodeMirror's undo, so a key press that gets through reaches the browser instead. The browser
      // would change the text in the cell, and that change would come back as a new notebook edit.
      event.preventDefault();

      if (isUndo) {
        history.undo();
      } else {
        history.redo();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [history]);

  return (
    <Stack gap={0.5}>
      <IconButton
        name="redo"
        className={undoClass}
        tooltip={
          undoLabel
            ? t('notebooks.history.undo-action', 'Undo: {{action}}', { action: undoLabel })
            : t('notebooks.history.undo', 'Undo')
        }
        disabled={!canUndo}
        onClick={() => history.undo()}
      />
      <IconButton
        name="redo"
        tooltip={
          redoLabel
            ? t('notebooks.history.redo-action', 'Redo: {{action}}', { action: redoLabel })
            : t('notebooks.history.redo', 'Redo')
        }
        disabled={!canRedo}
        onClick={() => history.redo()}
      />
    </Stack>
  );
}

/** Whether the keystroke belongs to the browser's own undo rather than the notebook's. */
function browserOwnsUndo(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  // A code cell is contenteditable and so would match the check below, but CodeMirror is built with
  // its own history off, which leaves undo in there to the notebook.
  if (target.closest('.cm-editor')) {
    return false;
  }

  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

const undoClass = css({
  svg: {
    transform: 'scaleX(-1)',
  },
});
