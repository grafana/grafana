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
 * The notebook title while the notebook is being edited: click the heading to open a field, blur to
 * close it again.
 *
 * Every keystroke is reported, not just the closing one. Autosave ignores changes made once the
 * notebook has left edit mode, and it can be left without this field ever blurring — the browser's
 * Back button dropping `?edit=true` does exactly that — so a value held back until blur would arrive
 * too late to be written.
 */
export function NotebookTitleEditor({ title, onChange }: Props) {
  const styles = useStyles2(getStyles);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [showEmptyError, setShowEmptyError] = useState(false);
  /** The title this edit started from, so Escape has something to put back. */
  const titleBeforeEdit = useRef(title);

  // Stable, so it runs on mount alone - an inline callback would re-select the text on every keystroke.
  const focusInput = useCallback((input: HTMLInputElement | null) => {
    input?.focus();
    input?.select();
  }, []);

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

    // Never report an empty title: it is required, and autosave would write the notebook nameless.
    // Holding the last real one back is what lets the field stay open with an error rather than block.
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
          `title` rather than `aria-label`: it names the button alone, so the h1 still announces the
          notebook's name. Rendered whatever the title is - an emptied one would otherwise lose the
          only control that can give it another.
        */}
        <button
          type="button"
          className={styles.trigger}
          title={t('dashboard.notebook-layout.title-edit', 'Edit title')}
          onClick={() => {
            // Seeded on open rather than kept in step with the prop, so a title replaced elsewhere is
            // picked up without anything overwriting what someone is in the middle of typing.
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
    // Padding to give the hover tint room, negative margin to keep the text where the heading put it.
    padding: theme.spacing(0, 1),
    margin: theme.spacing(0, -1),
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  field: css({
    width: '100%',
    // Pulled back by the input's own border and padding, so the title does not step right on opening.
    position: 'relative',
    left: `calc(-${theme.spacing(1)} - 1px)`,
  }),
  input: css({
    input: {
      ...theme.typography.h1,
    },
  }),
});
