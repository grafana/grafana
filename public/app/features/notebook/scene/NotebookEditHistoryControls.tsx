import { css } from '@emotion/css';
import { useEffect } from 'react';

import { t } from '@grafana/i18n';
import { IconButton, Stack } from '@grafana/ui';

import { type NotebookEditHistory } from './NotebookEditHistory';

export function NotebookEditHistoryControls({ history, enabled }: { history: NotebookEditHistory; enabled: boolean }) {
  const { canUndo, canRedo, undoLabel, redoLabel } = history.useState();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || (!event.metaKey && !event.ctrlKey) || isNativeEditingTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      const handled =
        key === 'z'
          ? event.shiftKey
            ? history.redo()
            : history.undo()
          : key === 'y' && !event.shiftKey
            ? history.redo()
            : false;

      if (handled) {
        event.preventDefault();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enabled, history]);

  if (!enabled) {
    return null;
  }

  return (
    <Stack gap={0.5}>
      <IconButton
        name="history"
        tooltip={
          undoLabel
            ? t('notebooks.history.undo-action', 'Undo: {{action}}', { action: undoLabel })
            : t('notebooks.history.undo', 'Undo')
        }
        disabled={!canUndo}
        onClick={() => history.undo()}
      />
      <IconButton
        name="history"
        className={redoClass}
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

function isNativeEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element) || target.closest('.cm-editor')) {
    return false;
  }

  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

const redoClass = css({
  svg: {
    transform: 'scaleX(-1)',
  },
});
