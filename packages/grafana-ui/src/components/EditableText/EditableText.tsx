import { css } from '@emotion/css';
import React, { useCallback, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { AutoSaveField } from '../AutoSaveField/AutoSaveField';
import { IconButton } from '../IconButton/IconButton';
import { Input } from '../Input/Input';
import { Text, TextProps } from '../Text/Text';

export interface EditableTextProps extends Omit<TextProps, 'truncate'> {
  children: string;
  onEdit: (newValue: string) => Promise<void>;
  editLabel: string;
}

export const EditableText = ({ editLabel, onEdit, ...textProps }: EditableTextProps) => {
  const styles = useStyles2(getStyles);
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
    <div style={{ width: '400px' }}>
      {!isEditing && !changeInProgress && (
        <div className={styles.textWrapper}>
          <Text {...textProps} truncate />
          <IconButton name="pen" ariaLabel={editLabel} onClick={() => setIsEditing(true)} />
        </div>
      )}
      {(isEditing || changeInProgress) && (
        <AutoSaveField onFinishChange={onFinishChange}>
          {(onChange) => (
            <Input
              defaultValue={textProps.children}
              onChange={(event) => {
                setChangeInProgress(true);
                if (timeoutID.current) {
                  window.clearTimeout(timeoutID.current);
                }
                onChange(event.currentTarget.value);
              }}
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

EditableText.displayName = 'EditableText';

const getStyles = (theme: GrafanaTheme2) => ({
  textWrapper: css({
    alignItems: 'center',
    display: 'flex',
    gap: theme.spacing(1),
  }),
});
