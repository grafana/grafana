import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { isFetchError } from '@grafana/runtime';
import { Field, IconButton, Input, useStyles2 } from '@grafana/ui';
import { H1 } from '@grafana/ui/src/unstable';

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

  // sync local value with prop value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const onCommitChange = useCallback(
    async (event: React.FormEvent<HTMLInputElement>) => {
      const newValue = event.currentTarget.value;

      if (!newValue) {
        setErrorMessage('Please enter a title');
      } else if (newValue === value) {
        // no need to bother saving if the value hasn't changed
        // just clear any previous error messages and exit edit mode
        setErrorMessage(undefined);
        setIsEditing(false);
      } else {
        setIsLoading(true);
        try {
          await onEdit(newValue);
          setErrorMessage(undefined);
          setIsEditing(false);
        } catch (error) {
          if (isFetchError(error)) {
            setErrorMessage(error.data.message);
          } else if (error instanceof Error) {
            setErrorMessage(error.message);
          }
        }
        setIsLoading(false);
      }
    },
    [onEdit, value]
  );

  return !isEditing ? (
    <div className={styles.textContainer}>
      <div className={styles.textWrapper}>
        {/*
          use localValue instead of value
          this is to prevent the title from flickering back to the old value after the user has edited
          caused by the delay between the save completing and the new value being refetched
        */}
        <H1 truncate>{localValue}</H1>
        <IconButton name="pen" size="lg" tooltip="Edit title" onClick={() => setIsEditing(true)} />
      </div>
    </div>
  ) : (
    <div className={styles.inputContainer}>
      <Field className={styles.field} loading={isLoading} invalid={!!errorMessage} error={errorMessage}>
        <Input
          className={styles.input}
          defaultValue={localValue}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onCommitChange(event);
            }
          }}
          // perfectly reasonable to autofocus here since we've made a conscious choice by clicking the edit button
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          onBlur={onCommitChange}
          onChange={(event) => setLocalValue(event.currentTarget.value)}
          onFocus={() => setIsEditing(true)}
        />
      </Field>
    </div>
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
      flex: 1,
    }),
    textWrapper: css({
      alignItems: 'center',
      display: 'flex',
      gap: theme.spacing(1),
    }),
  };
};
