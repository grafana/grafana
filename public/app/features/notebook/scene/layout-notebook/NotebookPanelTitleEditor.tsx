import { css } from '@emotion/css';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Input, Text, useStyles2 } from '@grafana/ui';

import { type NotebookCellItem } from './NotebookCellItem';

/**
 * A panel's title while the notebook is being edited: click it to open a field, blur to close it
 * again - the same mechanics as NotebookTitleEditor (the notebook's own title), scoped to one panel.
 *
 * Rendered into the panel's `titleItems` rather than its `title` — see NotebookCellItemState.panelTitle
 * for why — so this is the only thing that ever shows where a title would otherwise be. Unlike the
 * notebook's own title, an empty panel title is a valid, normal state (shown as a placeholder), not an
 * error: a panel is already labelled by the prose around it, so there's nothing here to validate.
 *
 * `isEditing` is the notebook's edit mode, not this control's own open/closed state (`renaming`
 * below) — a reader can't rename a panel, so in view mode this renders the title as plain text, or
 * nothing at all rather than an "Add a title" prompt that has nothing to invite them to click.
 */
export function NotebookPanelTitleEditor({ cell, isEditing }: { cell: NotebookCellItem; isEditing: boolean }) {
  const styles = useStyles2(getStyles);
  const { panelTitle = '' } = cell.useState();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(panelTitle);
  /** What Escape puts back. */
  const titleBeforeEdit = useRef(panelTitle);
  /** Set only by the keyboard close paths: a blur has already put focus where the reader wanted it. */
  const shouldRestoreFocus = useRef(false);

  // Leaving edit mode mid-rename (e.g. the notebook's own Done button) must not leave this stuck
  // open - the next entry into edit mode would otherwise show a field over a title nobody is renaming.
  useEffect(() => {
    if (!isEditing) {
      setRenaming(false);
    }
  }, [isEditing]);

  // Stable, so it runs on mount alone - an inline callback would re-select the text on every keystroke.
  const focusInput = useCallback((input: HTMLInputElement | null) => {
    input?.focus();
    input?.select();
  }, []);

  // The mirror of focusInput: closing the field unmounts the focused input, which drops focus onto the
  // document, so the trigger takes it back as it mounts - but only when a key was what closed it.
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
    // The draft keeps the raw text so spaces can be typed; only what is reported is trimmed.
    setDraft(next);
    cell.onPanelTitleChange(next.trim());
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // An IME sends Enter to confirm its candidate and Escape to abandon it, both mid-composition.
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
          {panelTitle}
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
            // Seeded on open rather than kept in step with the prop, so a title changed elsewhere
            // (undo, a sibling cell sharing this element) is picked up rather than overwritten.
            titleBeforeEdit.current = panelTitle;
            setDraft(panelTitle);
            setRenaming(true);
          }}
        >
          {panelTitle || t('notebook.cell.panel.title-placeholder', 'Add a title')}
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
  // PanelChrome's own header padding alone reads as flush against the panel's edge. Kept separate
  // from the trigger's own padding below, which only needs to be big enough for its hover tint - a
  // wider left pad there would stretch that tint into an odd, asymmetric shape instead.
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
    // Padding to give the hover tint room, negative margin to keep the text where it would sit without it.
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
