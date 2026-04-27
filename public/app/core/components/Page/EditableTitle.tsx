import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';
import * as React from 'react';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { Trans, t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { Field, IconButton, Input, Text } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

export interface Props {
  value: string;
  onEdit: (newValue: string) => Promise<void>;
}

export const EditableTitle = ({ value, onEdit }: Props) => {
  const styles = useStyles2(getStyles);
  const [localValue, setLocalValue] = useState(value);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const shouldSkipBlurSubmit = useRef(false);

  // sync local value with prop value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const onCancel = () => {
    setLocalValue(value);
    setErrorMessage(undefined);
    setIsEditing(false);
  };

  const onBlur = (event: React.FormEvent<HTMLInputElement>) => {
    if (shouldSkipBlurSubmit.current) {
      shouldSkipBlurSubmit.current = false;
      return;
    }

    void onSubmit(event);
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement | HTMLInputElement>) => {
    event.preventDefault();
    if (isLoading) {
      return;
    }

    if (!localValue) {
      setErrorMessage(t('page.editable-title.required', 'Please enter a title'));
      return;
    }

    if (localValue === value) {
      onCancel();
      return;
    }

    setIsLoading(true);
    try {
      await onEdit(localValue);
      setErrorMessage(undefined);
      setIsEditing(false);
    } catch (error) {
      if (isFetchError(error)) {
        setErrorMessage(error.data.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t('page.editable-title.error', 'An unknown error occurred'));
      }
    }
    setIsLoading(false);
  };

  return !isEditing ? (
    <div className={styles.textContainer}>
      <div className={styles.textWrapper}>
        {/*
          use localValue instead of value
          this is to prevent the title from flickering back to the old value after the user has edited
          caused by the delay between the save completing and the new value being refetched
        */}
        <Text element="h1" truncate>
          {localValue}
        </Text>
        <IconButton
          name="pen"
          size="lg"
          tooltip={t('page.editable-title.edit-tooltip', 'Edit title')}
          onClick={() => setIsEditing(true)}
        />
      </div>
    </div>
  ) : (
    <form className={styles.inputContainer} onSubmit={onSubmit}>
      <Field
        className={styles.field}
        label={
          <label htmlFor="page-editable-title" className="sr-only">
            <Trans i18nKey="page.editable-title.label">Name</Trans>
          </label>
        }
        disabled={isLoading}
        loading={isLoading}
        invalid={!!errorMessage}
        error={errorMessage}
        noMargin
      >
        <Input
          id="page-editable-title"
          type="text"
          className={styles.input}
          defaultValue={localValue}
          placeholder={t('page.editable-title.placeholder', 'Name')}
          // perfectly reasonable to autofocus here since we've made a conscious choice by clicking the edit button
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          autoComplete="off"
          onBlur={onBlur}
          onChange={(event) => setLocalValue(event.currentTarget.value)}
          onFocus={() => setIsEditing(true)}
        />
      </Field>
      <div className={styles.buttons}>
        <IconButton
          name="check"
          size="lg"
          variant="secondary"
          tooltip={t('page.editable-title.save-tooltip', 'Save')}
          type="submit"
          disabled={isLoading}
        />
        <IconButton
          name="times"
          size="lg"
          variant="secondary"
          tooltip={t('page.editable-title.cancel-tooltip', 'Cancel')}
          onMouseDown={() => {
            shouldSkipBlurSubmit.current = true;
          }}
          onClick={onCancel}
          disabled={isLoading}
        />
      </div>
    </form>
  );
};

EditableTitle.displayName = 'EditableTitle';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    textContainer: css({
      minWidth: 0,
    }),
    field: css({
      flex: 1,
      // magic number here to ensure the input text lines up exactly with the h1 text
      // input has a 1px border + theme.spacing(1) padding so we need to offset that
      left: `calc(-${theme.spacing(1)} - 1px)`,
      position: 'relative',
      marginBottom: 0,
    }),
    input: css({
      input: {
        ...theme.typography.h1,
      },
    }),
    inputContainer: css({
      display: 'flex',
      alignItems: 'baseline',
      flex: 1,
      gap: theme.spacing(1),
    }),
    textWrapper: css({
      alignItems: 'center',
      display: 'flex',
      gap: theme.spacing(1),
      height: theme.spacing(theme.components.height.md),
    }),
    buttons: css({
      display: 'flex',
      gap: theme.spacing(1),
      position: 'relative',
      // align the buttons to the center of the input
      // do this via baseline + top to avoid issues when an error shows
      top: theme.spacing(-0.25),
    }),
  };
};
