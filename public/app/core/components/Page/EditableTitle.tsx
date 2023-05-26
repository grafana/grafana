import { css } from '@emotion/css';
import React, { useCallback, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { isFetchError } from '@grafana/runtime';
import { AutoSaveField, IconButton, Input, useStyles2 } from '@grafana/ui';
import { H1 } from '@grafana/ui/src/unstable';

export interface Props {
  value: string;
  onEdit: (newValue: string) => Promise<void>;
}

export const EditableTitle = ({ value, onEdit }: Props) => {
  const styles = useStyles2(getStyles);
  const [isEditing, setIsEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [changeInProgress, setChangeInProgress] = useState(false);
  const timeoutID = useRef<number>();

  const onFinishChange = useCallback(
    async (newValue: string) => {
      try {
        await onEdit(newValue);
      } catch (error) {
        if (isFetchError(error)) {
          setErrorMessage(error.data.message);
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        }
        throw error;
      }
      timeoutID.current = window.setTimeout(() => {
        setChangeInProgress(false);
      }, 2000);
    },
    [onEdit]
  );

  return !isEditing && !changeInProgress ? (
    <div className={styles.textContainer}>
      {!isEditing && !changeInProgress && (
        <div className={styles.textWrapper}>
          <H1 truncate>{value}</H1>
          <IconButton name="pen" size="lg" tooltip="Edit title" onClick={() => setIsEditing(true)} />
        </div>
      )}
    </div>
  ) : (
    <div className={styles.inputContainer}>
      <AutoSaveField saveErrorMessage={errorMessage} className={styles.field} onFinishChange={onFinishChange}>
        {(onChange) => (
          <Input
            className={styles.input}
            defaultValue={value}
            onChange={(event) => {
              if (event.currentTarget.value) {
                setChangeInProgress(true);
                if (timeoutID.current) {
                  window.clearTimeout(timeoutID.current);
                }
                onChange(event.currentTarget.value);
              }
            }}
            // perfectly reasonable to autofocus here since we've made a conscious choice by clicking the edit button
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onBlur={() => setIsEditing(false)}
            onFocus={() => setIsEditing(true)}
          />
        )}
      </AutoSaveField>
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
      marginBottom: 0,
    }),
    input: css({
      input: {
        ...theme.typography.h1,
        // magic number here to ensure the input text lines up exactly with the h1 text
        // input has a 1px border + theme.spacing(1) padding so we need to offset that
        left: `calc(-${theme.spacing(1)} - 1px)`,
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
