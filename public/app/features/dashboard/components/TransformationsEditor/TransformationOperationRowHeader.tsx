import { css, cx } from '@emotion/css';
import * as React from 'react';
import { useState } from 'react';
import { useToggle } from 'react-use';

import { GrafanaTheme2, DataTransformerConfig } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FieldValidationMessage, Icon, Input, useStyles2 } from '@grafana/ui';

export interface Props {
  index: number;
  transformation: DataTransformerConfig;
  transformations: DataTransformerConfig[];
  transformationTypeName: string;
  disabled?: boolean;
  onChange: (index: number, config: DataTransformerConfig) => void;
  dynamicRefId?: string;
}

export const TransformationOperationRowHeader = (props: Props) => {
  const { index, transformation, transformations, onChange, disabled, transformationTypeName, dynamicRefId } = props;

  const styles = useStyles2(getStyles);
  const [isRefIdEditing, toggleIsRefIdEditing] = useToggle(false);
  const [isStaticRefId, setIsStaticRefId] = useState(transformation.refId !== undefined);
  const [validationError, setValidationError] = useState<string | null>(null);

  const onEndEditRefId = (newRefId: string) => {
    const trimmedNewRefId = newRefId.trim();
    toggleIsRefIdEditing(false);

    // Ignore change if invalid
    if (validationError) {
      setValidationError(null);
      return;
    }

    if (transformation.refId !== trimmedNewRefId && trimmedNewRefId !== '') {
      setIsStaticRefId(true);
      onChange(index, {
        ...transformation,
        refId: trimmedNewRefId,
      });
    } else if (trimmedNewRefId === '') {
      // if it was previously custom and is now empty, it is being cleared out and we want to save it as undefined
      if (isStaticRefId) {
        onChange(index, {
          ...transformation,
          refId: undefined,
        });
      }
      // either way, if it is empty, we want it to display as not static
      setIsStaticRefId(false);
    }
  };

  const onInputChange = (event: React.SyntheticEvent<HTMLInputElement>) => {
    const newRefId = event.currentTarget.value.trim();

    for (const otherTransformation of transformations) {
      if (otherTransformation !== transformation && newRefId === otherTransformation.refId) {
        setValidationError('Transformation name already exists');
        return;
      }
    }

    if (validationError) {
      setValidationError(null);
    }
  };

  const onEditRefIdBlur = (event: React.SyntheticEvent<HTMLInputElement>) => {
    onEndEditRefId(event.currentTarget.value.trim());
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      onEndEditRefId(event.currentTarget.value);
    }
  };

  const onFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    event.target.select();
  };

  return (
    <div className={styles.wrapper}>
      {!isRefIdEditing && (
        <button
          className={styles.refIdWrapper}
          title={t(
            'dashboard.transformation-operation-row.transformation-editor-row-header.edit-refId',
            'Edit transformation name'
          )}
          onClick={() => toggleIsRefIdEditing()}
          data-testid="query-name-div"
          type="button"
        >
          <span className={cx(styles.refIdStyle, !isStaticRefId && styles.placeholderText)}>
            {transformation.refId ||
              dynamicRefId ||
              t(
                'dashboard.transformation-operation-row.transformation-editor-row-header.edit-refId-placeholder',
                '(Auto)'
              )}
          </span>
          <Icon name="pen" className={styles.refIdEditIcon} size="sm" />
        </button>
      )}

      {isRefIdEditing && (
        <>
          <Input
            type="text"
            defaultValue={transformation.refId}
            onBlur={onEditRefIdBlur}
            autoFocus
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            invalid={validationError !== null}
            onChange={onInputChange}
            className={styles.refIdInput}
            data-testid="transformation-refid-input"
          />
          {validationError && <FieldValidationMessage horizontal>{validationError}</FieldValidationMessage>}
        </>
      )}
      <div>
        <div className={cx(styles.title, disabled && styles.disabled)}>{transformationTypeName}</div>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      label: 'Wrapper',
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
    }),
    refIdWrapper: css({
      display: 'flex',
      cursor: 'pointer',
      border: '1px solid transparent',
      borderRadius: theme.shape.radius.default,
      alignItems: 'center',
      margin: 0,
      background: 'transparent',
      overflow: 'hidden',

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
    refIdStyle: css({
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.primary.text,
      cursor: 'pointer',
      overflow: 'hidden',
    }),
    refIdEditIcon: cx(
      css({
        marginLeft: theme.spacing(1),
        visibility: 'hidden',
      }),
      'query-name-edit-icon'
    ),
    refIdInput: css({
      maxWidth: '300px',
      margin: '-4px 0',
    }),
    placeholderText: css({
      fontWeight: theme.typography.fontWeightRegular,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      alignItems: 'center',
      fontStyle: 'italic',
      textOverflow: 'ellipsis',
    }),
    title: css({
      fontWeight: theme.typography.fontWeightBold,
      color: theme.colors.text.link,
      marginLeft: theme.spacing(0.5),
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    disabled: css({
      color: theme.colors.text.disabled,
    }),
  };
};
