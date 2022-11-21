import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Input, FieldValidationMessage, HorizontalGroup, useStyles2 } from '@grafana/ui';

export interface QueryNameProps {
  name: string;
  editingEnabled: boolean;
  onChange: (v: string) => void;
}

export const QueryName = ({ name, onChange, editingEnabled }: QueryNameProps) => {
  const styles = useStyles2(getStyles);

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const onEditQueryName = (event: React.SyntheticEvent) => {
    setIsEditing(true);
  };

  const onEndEditName = (newName: string) => {
    setIsEditing(false);

    if (validationError) {
      setValidationError(null);
      return;
    }

    if (name !== newName) {
      onChange(newName);
    }
  };

  const onInputChange = (event: React.SyntheticEvent<HTMLInputElement>) => {
    const newName = event.currentTarget.value.trim();

    if (newName.length === 0) {
      setValidationError('An empty name is not allowed');
      return;
    }

    if (validationError) {
      setValidationError(null);
    }
  };

  const onEditLayerBlur = (event: React.SyntheticEvent<HTMLInputElement>) => {
    onEndEditName(event.currentTarget.value.trim());
  };

  const onFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    event.target.select();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      if (!(event.target instanceof HTMLInputElement)) {
        return;
      }

      onEndEditName(event.target.value);
    }
  };

  return (
    <>
      <div className={styles.wrapper}>
        {!isEditing && (
          <HorizontalGroup>
            <h2 className={styles.h2Style}>{name}</h2>
            {editingEnabled && <Icon name="pen" className={styles.nameEditIcon} size="md" onClick={onEditQueryName} />}
          </HorizontalGroup>
        )}

        {isEditing && (
          <>
            <Input
              type="text"
              defaultValue={name}
              onBlur={onEditLayerBlur}
              onFocus={onFocus}
              autoFocus={true}
              onKeyDown={onKeyDown}
              invalid={validationError !== null}
              onChange={onInputChange}
              className={styles.nameInput}
            />
            {validationError && <FieldValidationMessage horizontal>{validationError}</FieldValidationMessage>}
          </>
        )}
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      display: flex;
      align-items: center;
      margin-left: ${theme.v1.spacing.xs};
    `,
    nameEditIcon: css`
      cursor: pointer;
      color: ${theme.colors.text.secondary};
      width: 12px;
      height: 12px;
    `,
    nameInput: css`
      max-width: 300px;
      margin: -8px 0;
    `,
    h2Style: css`
      margin-bottom: 0;
    `,
  };
};
