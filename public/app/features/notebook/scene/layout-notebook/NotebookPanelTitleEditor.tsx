import { css } from '@emotion/css';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { Input, Text, useStyles2 } from '@grafana/ui';

import { type NotebookCellItem } from './NotebookCellItem';

/**
 * A panel's title: click to edit, blur to close - same as NotebookTitleEditor, scoped to one panel.
 * Rendered into `titleItems` rather than `title` (see NotebookCellItemState.panelTitle for why), and
 * `displayTitle` interpolates it for display since `panelTitle` can carry a time macro.
 */
export function NotebookPanelTitleEditor({
  cell,
  panel,
  isEditing,
}: {
  cell: NotebookCellItem;
  panel: VizPanel;
  isEditing: boolean;
}) {
  const styles = useStyles2(getStyles);
  const { panelTitle = '' } = cell.useState();
  const displayTitle = sceneGraph.interpolate(panel, panelTitle, undefined, 'text');
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(panelTitle);
  /** What Escape puts back. */
  const titleBeforeEdit = useRef(panelTitle);
  /** Set only on a keyboard close - a blur already put focus where the reader wanted it. */
  const shouldRestoreFocus = useRef(false);

  // Don't leave the field open if edit mode is left mid-rename.
  useEffect(() => {
    if (!isEditing) {
      setRenaming(false);
    }
  }, [isEditing]);

  const focusInput = useCallback((input: HTMLInputElement | null) => {
    input?.focus();
    input?.select();
  }, []);

  // Restores focus to the trigger after a keyboard close unmounts the input.
  const focusTrigger = useCallback((button: HTMLButtonElement | null) => {
    if (!shouldRestoreFocus.current) {
      return;
    }

    shouldRestoreFocus.current = false;
    button?.focus();
  }, []);

  const commit = () => {
    const trimmed = draft.trim();
    setDraft(trimmed);
    if (trimmed !== panelTitle) {
      cell.onPanelTitleChange(trimmed);
    }
    cell.onPanelTitleCommit();
    setRenaming(false);
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.currentTarget.value;
    setDraft(next); // kept untrimmed so spaces can be typed
    cell.onPanelTitleChange(next.trim());
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      shouldRestoreFocus.current = true;
      commit();
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      shouldRestoreFocus.current = true;
      setDraft(titleBeforeEdit.current);
      cell.onPanelTitleChange(titleBeforeEdit.current);
      cell.onPanelTitleCommit();
      setRenaming(false);
    }
  };

  if (!isEditing) {
    return panelTitle ? (
      <div className={styles.wrapper}>
        <Text element="h2" variant="h6" truncate>
          {displayTitle}
        </Text>
      </div>
    ) : null;
  }

  if (!renaming) {
    return (
      <div className={styles.wrapper}>
        <button
          type="button"
          ref={focusTrigger}
          className={styles.trigger}
          title={t('notebook.cell.panel.title-edit', 'Edit panel title')}
          onClick={() => {
            titleBeforeEdit.current = panelTitle;
            setDraft(panelTitle);
            setRenaming(true);
          }}
        >
          {displayTitle || t('notebook.cell.panel.title-placeholder', 'Add a title')}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <Input
        ref={focusInput}
        className={styles.input}
        aria-label={t('notebook.cell.panel.title-label', 'Panel title')}
        value={draft}
        autoComplete="off"
        onChange={onInputChange}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Kept separate from the trigger's own padding so its hover tint stays a plain box.
  wrapper: css({
    paddingLeft: theme.spacing(1),
  }),
  trigger: css({
    ...theme.typography.h6,
    color: 'inherit',
    background: 'none',
    border: 'none',
    cursor: 'text',
    maxWidth: 240,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    borderRadius: theme.shape.radius.default,
    // Padding for the hover tint, margin to cancel it back out.
    padding: theme.spacing(0, 0.5),
    margin: theme.spacing(0, -0.5),
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  input: css({
    width: 220,
    input: {
      ...theme.typography.h6,
      height: 24,
    },
  }),
});
