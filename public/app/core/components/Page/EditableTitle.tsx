import { css, cx } from '@emotion/css';
import React, { useCallback, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { AutoSaveField } from '@grafana/ui/src/components/AutoSaveField/AutoSaveField';
import { IconButton } from '@grafana/ui/src/components/IconButton/IconButton';
import { getInputStyles } from '@grafana/ui/src/components/Input/Input';
import { Text } from '@grafana/ui/src/components/Text/Text';
import { useStyles2, useTheme2 } from '@grafana/ui/src/themes';

export interface Props {
  value: string;
  onEdit: (newValue: string) => Promise<void>;
}

export const EditableTitle = ({ value, onEdit }: Props) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const inputStyles = getInputStyles({ theme });
  const [isEditing, setIsEditing] = useState(false);
  const [changeInProgress, setChangeInProgress] = useState(false);
  const timeoutID = useRef<number>();

  const onFinishChange = useCallback(
    async (newValue: string) => {
      await onEdit(newValue);
      timeoutID.current = window.setTimeout(() => {
        setChangeInProgress(false);
      }, 1000);
    },
    [onEdit]
  );

  return (
    <div className={styles.container}>
      {!isEditing && !changeInProgress && (
        <div className={styles.textWrapper}>
          <Text as="h1" truncate>
            {value}
          </Text>
          <IconButton name="pen" size="lg" ariaLabel="Edit title" onClick={() => setIsEditing(true)} />
        </div>
      )}
      {(isEditing || changeInProgress) && (
        <AutoSaveField className={styles.field} onFinishChange={onFinishChange}>
          {(onChange) => (
            <input
              className={cx(inputStyles.input, styles.input)}
              defaultValue={value}
              onChange={(event) => {
                setChangeInProgress(true);
                if (timeoutID.current) {
                  window.clearTimeout(timeoutID.current);
                }
                onChange(event.currentTarget.value);
              }}
              // perfectly reasonable to autofocus here since we've made a conscious choice by clicking the edit button
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              onBlur={() => setIsEditing(false)}
              onFocus={() => setIsEditing(true)}
            />
          )}
        </AutoSaveField>
      )}
    </div>
  );
};

EditableTitle.displayName = 'EditableTitle';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      minHeight: '36px',
      width: '400px',
    }),
    field: css({
      marginBottom: 0,
    }),
    input: css({
      ...theme.typography.h1,
      // some magic numbers here to ensure the input text lines up exactly with the h1 text
      left: '-9px',
      top: '-2px',
    }),
    textWrapper: css({
      alignItems: 'center',
      display: 'flex',
      gap: theme.spacing(1),
    }),
  };
};
