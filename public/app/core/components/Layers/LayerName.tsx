import { css, cx } from '@emotion/css';
import { useState } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Input, FieldValidationMessage, useStyles2 } from '@grafana/ui';

import { t } from '../../internationalization';

export interface LayerNameProps {
  name: string;
  onChange: (v: string) => void;
  verifyLayerNameUniqueness?: (nameToCheck: string) => boolean;
  overrideStyles?: boolean;
}

export const LayerName = ({ name, onChange, verifyLayerNameUniqueness, overrideStyles }: LayerNameProps) => {
  const styles = useStyles2(getStyles);

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

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      onEndEditName(event.currentTarget.value);
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
            title={t('layers.layer-name.edit-layer-title', 'Edit layer name')}
            onClick={onEditLayer}
            data-testid="layer-name-div"
          >
            <span className={overrideStyles ? '' : styles.layerName}>{name}</span>
            <Icon name="pen" className={styles.layerEditIcon} size="sm" />
          </button>
        )}

        {isEditing && (
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
        )}
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      label: 'Wrapper',
      display: 'flex',
      alignItems: 'center',
      marginLeft: theme.spacing(0.5),
    }),
    layerNameWrapper: css({
      display: 'flex',
      cursor: 'pointer',
      border: '1px solid transparent',
      borderRadius: theme.shape.radius.default,
      alignItems: 'center',
      padding: `0 0 0 ${theme.spacing(0.5)}`,
      margin: 0,
      background: 'transparent',

      '&:hover': {
        background: theme.colors.action.hover,
        border: `1px dashed ${theme.colors.border.strong}`,
      },

      '&:focus': {
        border: `2px solid ${theme.colors.primary.border}`,
      },

      '&:hover, &:focus': {
        '.query-name-edit-icon': {
          visibility: 'visible',
        },
      },
    }),
    layerName: css({
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.primary.text,
      cursor: 'pointer',
      overflow: 'hidden',
      marginLeft: theme.spacing(0.5),
    }),
    layerEditIcon: cx(
      css({
        marginLeft: theme.spacing(2),
        visibility: 'hidden',
      }),
      'query-name-edit-icon'
    ),
    layerNameInput: css({
      maxWidth: '300px',
      margin: '-4px 0',
    }),
  };
};
