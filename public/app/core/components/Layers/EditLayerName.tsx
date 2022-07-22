import { css, cx } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme } from '@grafana/data';
import { Input, FieldValidationMessage, useStyles } from '@grafana/ui';

export interface LayerNameProps {
  name: string;
  UID: number;
  editElementId: number | null;
  isEditing: boolean;
  setEditElementId: (uid: number | null) => void;
  onChange: (v: string) => void;
  verifyLayerNameUniqueness?: (nameToCheck: string) => boolean;
}

export const EditLayerName = ({
  name,
  onChange,
  verifyLayerNameUniqueness,
  editElementId,
  UID,
  setEditElementId,
  isEditing,
}: LayerNameProps) => {
  const styles = useStyles(getStyles);

  const [validationError, setValidationError] = useState<string | null>(null);

  const onEndEditName = (newName: string) => {
    setEditElementId(null);

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
      setValidationError('An empty layer name is not allowed');
      return;
    }

    if (verifyLayerNameUniqueness && !verifyLayerNameUniqueness(newName) && newName !== name) {
      setValidationError('Layer name already exists');
      return;
    }

    if (validationError) {
      setValidationError(null);
    }
  };

  const onEditLayerBlur = (event: React.SyntheticEvent<HTMLInputElement>) => {
    onEndEditName(event.currentTarget.value.trim());
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      onEndEditName((event.target as any).value);
    }
  };

  const onFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    event.target.select();
  };

  const renderLayerNameInput = () => {
    if (isEditing && editElementId === UID) {
      return (
        <>
          <Input
            type="text"
            defaultValue={name}
            onBlur={onEditLayerBlur}
            autoFocus
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            invalid={validationError !== null}
            onChange={onInputChange}
            className={styles.layerNameInput}
            data-testid="layer-name-input"
          />
          {validationError && <FieldValidationMessage horizontal>{validationError}</FieldValidationMessage>}
        </>
      );
    } else {
      return <span className={styles.layerName}>{name}</span>;
    }
  };

  return (
    <>
      <div className={styles.wrapper}>{renderLayerNameInput()}</div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    wrapper: css`
      label: Wrapper;
      display: flex;
      align-items: center;
      margin-left: ${theme.spacing.xs};
    `,
    layerNameWrapper: css`
      display: flex;
      cursor: pointer;
      border: 1px solid transparent;
      border-radius: ${theme.border.radius.md};
      align-items: center;
      padding: 0 0 0 ${theme.spacing.xs};
      margin: 0;
      background: transparent;

      &:hover {
        background: ${theme.colors.bg3};
        border: 1px dashed ${theme.colors.border3};
      }

      &:focus {
        border: 2px solid ${theme.colors.formInputBorderActive};
      }

      &:hover,
      &:focus {
        .query-name-edit-icon {
          visibility: visible;
        }
      }
    `,
    layerName: css`
      font-weight: ${theme.typography.weight.semibold};
      color: ${theme.colors.textBlue};
      cursor: pointer;
      overflow: hidden;
      margin-left: ${theme.spacing.xs};
    `,
    layerEditIcon: cx(
      css`
        margin-left: ${theme.spacing.md};
        visibility: hidden;
      `,
      'query-name-edit-icon'
    ),
    layerNameInput: css`
      max-width: 300px;
      margin: -4px 0;
    `,
  };
};
