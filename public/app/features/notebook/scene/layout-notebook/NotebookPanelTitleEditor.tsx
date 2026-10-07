import { css } from '@emotion/css';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { Input, Text, useStyles2 } from '@grafana/ui';

import { type NotebookCellItem } from './NotebookCellItem';

/**
 * A panel's title: click to open a field, blur to close it - same mechanics as NotebookTitleEditor
 * (the notebook's own title), scoped to one panel. Rendered into `titleItems` rather than `title` -
 * see NotebookCellItemState.panelTitle for why.
 *
 * Unlike the notebook's own title, an empty one is valid (shown as a placeholder), not an error - a
 * panel is already labelled by the prose around it. `isEditing` is the notebook's edit mode, not this
 * control's own open/closed state (`renaming`): a reader can't rename a panel, so view mode renders
 * plain text or nothing, never the "Add a title" prompt.
 *
 * `panelTitle` can carry a time macro (e.g. `${__from:date}`, preserved by buildPanelElementFromDashboard
 * so the title tracks the notebook's own time range) - `displayTitle` interpolates it for display,
 * the same way VizPanelRenderer would for a native title. The raw, uninterpolated value is what's
 * edited and stored; only the shown text is resolved.
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
            // Seeded on open rather than kept in step with the prop, so a title changed elsewhere
            // (undo, a sibling cell sharing this element) is picked up rather than overwritten.
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
  // Separate from the trigger's own padding, which only needs room for its hover tint - putting the
  // edge spacing there too would stretch that tint into an odd, asymmetric shape.
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
