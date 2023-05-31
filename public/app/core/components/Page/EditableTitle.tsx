import { css } from '@emotion/css';
import React, { useCallback, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { isFetchError } from '@grafana/runtime';
import { Field, Icon, IconButton, Input, Spinner, useStyles2 } from '@grafana/ui';
import { H1 } from '@grafana/ui/src/unstable';

export interface Props {
  value: string;
  onEdit: (newValue: string) => Promise<void>;
}

export const EditableTitle = ({ value, onEdit }: Props) => {
  const styles = useStyles2(getStyles);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditInProgress, setIsEditInProgress] = useState(false);
  // we use this to track whether the edit was successful so we can show a checkmark icon
  // this should get reset to false whenever we exit edit mode
  const [isEditSuccessful, setIsEditSuccessful] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const timeoutID = useRef<number>();

  const exitEditMode = () => {
    setIsEditing(false);
    setIsEditSuccessful(false);
  };

  const onCommitChange = useCallback(
    async (event: React.FormEvent<HTMLInputElement>) => {
      const newValue = event.currentTarget.value;

      if (!newValue) {
        setErrorMessage('Please enter a title');
      } else if (newValue === value) {
        // no need to bother saving if the value hasn't changed
        // just clear any previous error messages and exit edit mode
        setErrorMessage(undefined);
        exitEditMode();
      } else {
        setIsEditInProgress(true);
        if (timeoutID.current) {
          window.clearTimeout(timeoutID.current);
        }
        try {
          await onEdit(newValue);
          setErrorMessage(undefined);
          setIsEditSuccessful(true);
          timeoutID.current = window.setTimeout(() => {
            exitEditMode();
          }, 1500);
        } catch (error) {
          if (isFetchError(error)) {
            setErrorMessage(error.data.message);
          } else if (error instanceof Error) {
            setErrorMessage(error.message);
          }
        }
        setIsEditInProgress(false);
      }
    },
    [onEdit, value]
  );

  const getIcon = useCallback(() => {
    if (isEditInProgress) {
      return <Spinner />;
    } else if (isEditSuccessful) {
      return <Icon name="check" />;
    } else {
      return null;
    }
  }, [isEditInProgress, isEditSuccessful]);

  return !isEditing ? (
    <div className={styles.textContainer}>
      <div className={styles.textWrapper}>
        <H1 truncate>{value}</H1>
        <IconButton name="pen" size="lg" tooltip="Edit title" onClick={() => setIsEditing(true)} />
      </div>
    </div>
  ) : (
    <div className={styles.inputContainer}>
      <Field className={styles.field} invalid={!!errorMessage} error={errorMessage}>
        <Input
          className={styles.input}
          defaultValue={value}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onCommitChange(event);
            }
          }}
          // perfectly reasonable to autofocus here since we've made a conscious choice by clicking the edit button
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          suffix={getIcon()}
          onBlur={onCommitChange}
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
      minWidth: '200px',
      maxWidth: '75%',
    }),
    textWrapper: css({
      alignItems: 'center',
      display: 'flex',
      gap: theme.spacing(1),
    }),
  };
};
