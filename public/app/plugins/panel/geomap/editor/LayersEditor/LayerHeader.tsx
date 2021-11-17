import React, { useState } from 'react';
import { css, cx } from '@emotion/css';
import { Icon, Input, FieldValidationMessage, useStyles } from '@grafana/ui';
import { GrafanaTheme, MapLayerOptions } from '@grafana/data';

export interface LayerHeaderProps {
  layer: MapLayerOptions<any>;
  canRename: (v: string) => boolean;
  onChange: (layer: MapLayerOptions<any>) => void;
}

export const LayerHeader = ({ layer, canRename, onChange }: LayerHeaderProps) => {
  const styles = useStyles(getStyles);

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const onEditLayer = (event: React.SyntheticEvent) => {
    setIsEditing(true);
  };

  const onEndEditName = (newName: string) => {
    setIsEditing(false);

    if (validationError) {
      setValidationError(null);
      return;
    }

    if (layer.name !== newName) {
      onChange({
        ...layer,
        name: newName,
      });
    }
  };

  const onInputChange = (event: React.SyntheticEvent<HTMLInputElement>) => {
    const newName = event.currentTarget.value.trim();

    if (newName.length === 0) {
      setValidationError('An empty layer name is not allowed');
      return;
    }

    if (!canRename(newName)) {
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

  return (
    <>
      <div className={styles.wrapper}>
        {!isEditing && (
          <button
            className={styles.layerNameWrapper}
            title="Edit layer name"
            onClick={onEditLayer}
            data-testid="layer-name-div"
          >
            <span className={styles.layerName}>{layer.name}</span>
            <Icon name="pen" className={styles.layerEditIcon} size="sm" />
          </button>
        )}

        {isEditing && (
          <>
            <Input
              type="text"
              defaultValue={layer.name}
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
        )}
      </div>
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
