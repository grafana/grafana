import { css } from '@emotion/css';
import { useCallback, useRef, useState } from 'react';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Field, Input, Text, useStyles2 } from '@grafana/ui';

const TITLE_INPUT_ID = 'notebook-title';

interface Props {
  title: string;
  onChange: (title: string) => void;
}

/**
 * The notebook title, while the notebook is being edited: the heading itself is the way in, rather
 * than a pencil beside it, and there is no save button to press — the same bargain the cells make.
 *
 * Every keystroke is reported, not just the closing one. Autosave ignores changes made once the
 * notebook has left edit mode (see NotebookAutosave), and edit mode can be left without this field
 * ever blurring — the browser's Back button dropping `?edit=true` is the path that does it — so a
 * value held back until blur would be written to the scene too late to be saved, and lost on reload.
 * Blur only closes the field back into a heading.
 */
export function NotebookTitleEditor({ title, onChange }: Props) {
  const styles = useStyles2(getStyles);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [showEmptyError, setShowEmptyError] = useState(false);
  /** The title as it was when this edit began, so Escape has something to put back. */
  const titleBeforeEdit = useRef(title);

  // Focused through a ref rather than autoFocus so no lint suppression is needed, and stable so it
  // runs on mount alone — an inline callback would re-select the text on every keystroke.
  const focusInput = useCallback((input: HTMLInputElement | null) => {
    input?.focus();
    input?.select();
  }, []);

  /** Closes the field, unless there is nothing to close it on. */
  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setShowEmptyError(true);
      return;
    }

    setDraft(trimmed);
    if (trimmed !== title) {
      onChange(trimmed);
    }
    setIsEditing(false);
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.currentTarget.value;
    setDraft(next);

    // An emptied field reports nothing rather than an empty title: the scene's title is required and
    // autosave would write the notebook nameless. Holding the last real one back here is what lets
    // the field stay open with an error instead of having to block anything.
    if (!next.trim()) {
      return;
    }

    setShowEmptyError(false);
    onChange(next);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      commit();
    } else if (event.key === 'Escape') {
      // Stopped here so a scene above cannot also act on it.
      event.stopPropagation();
      setDraft(titleBeforeEdit.current);
      if (titleBeforeEdit.current !== title) {
        onChange(titleBeforeEdit.current);
      }
      setShowEmptyError(false);
      setIsEditing(false);
    }
  };

  if (!isEditing) {
    return (
      <Text element="h1" variant="h1">
        {/*
          `title` rather than `aria-label`: the tooltip is wanted on hover anyway, and the accessible
          name it produces stops at the button — the h1 above still computes its own name from the
          text, so the page announces its heading as the notebook's name and the control as "Edit
          title". An aria-label would name the button the same way but leaves no tooltip behind.

          Rendered whatever the title is — a notebook that lost its name would otherwise lose the only
          control that can give it another.
        */}
        <button
          type="button"
          className={styles.trigger}
          title={t('dashboard.notebook-layout.title-edit', 'Edit title')}
          onClick={() => {
            // Seeded here rather than kept in step with the prop, so a title replaced from elsewhere
            // (an APPLY_NOTEBOOK_SPEC rebuild) is picked up without anything being able to overwrite
            // what someone is in the middle of typing.
            titleBeforeEdit.current = title;
            setDraft(title);
            setShowEmptyError(false);
            setIsEditing(true);
          }}
        >
          {title || t('dashboard.notebook-layout.title-placeholder', 'Add a title')}
        </button>
      </Text>
    );
  }

  const isEmpty = !draft.trim();

  return (
    <Field
      className={styles.field}
      label={
        <label htmlFor={TITLE_INPUT_ID} className="sr-only">
          <Trans i18nKey="dashboard.notebook-layout.title-label">Title</Trans>
        </label>
      }
      invalid={showEmptyError && isEmpty}
      error={
        showEmptyError && isEmpty ? t('dashboard.notebook-layout.title-required', 'Please enter a title') : undefined
      }
      noMargin
    >
      <Input
        id={TITLE_INPUT_ID}
        ref={focusInput}
        className={styles.input}
        value={draft}
        autoComplete="off"
        onChange={onInputChange}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
    </Field>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  trigger: css({
    font: 'inherit',
    color: 'inherit',
    background: 'none',
    border: 'none',
    textAlign: 'left',
    cursor: 'text',
    borderRadius: theme.shape.radius.default,
    // The padding gives the hover tint room to breathe; the matching negative margin keeps the text
    // where the read-only heading put it, so nothing shifts on entering edit mode.
    padding: theme.spacing(0, 1),
    margin: theme.spacing(0, -1),
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  field: css({
    width: '100%',
    // Pulled back by the input's own border and padding, so the title stays on the same line it sat
    // on as a heading rather than stepping right when the field opens.
    position: 'relative',
    left: `calc(-${theme.spacing(1)} - 1px)`,
  }),
  input: css({
    input: {
      ...theme.typography.h1,
    },
  }),
});
