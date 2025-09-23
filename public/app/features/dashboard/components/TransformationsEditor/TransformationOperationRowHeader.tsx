import { css, cx } from '@emotion/css';
import * as React from 'react';
import { useState } from 'react';
import { useToggle } from 'react-use';

import { GrafanaTheme2, DataTransformerConfig } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Input, useStyles2 } from '@grafana/ui';

export interface Props {
  index: number;
  transformation: DataTransformerConfig;
  transformations: DataTransformerConfig[];
  transformationTypeName: string;
  disabled?: boolean;
  onChange: (index: number, config: DataTransformerConfig) => void;
}

export const TransformationOperationRowHeader = (props: Props) => {
  const { index, transformation, transformations, onChange, disabled, transformationTypeName } = props;

  const styles = useStyles2(getStyles);
  const [isRefIdEditing, toggleIsRefIdEditing] = useToggle(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const onEndEditRefId = (newRefId: string) => {
    toggleIsRefIdEditing(false);

    // Ignore change if invalid
    if (validationError) {
      setValidationError(null);
      return;
    }

    if (transformation.refId !== newRefId) {
      onChange(index, {
        ...transformation,
        refId: newRefId,
      });
    }
  };

  const onInputChange = (event: React.SyntheticEvent<HTMLInputElement>) => {
    const newRefId = event.currentTarget.value.trim();

    if (newRefId.length === 0) {
      setValidationError('An empty refId is not allowed');
      return;
    }

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
          title={t('query.query-editor-row-header.query-name-div-title-edit-query-name', 'Edit transformation name')}
          onClick={() => toggleIsRefIdEditing()}
          data-testid="query-name-div"
          type="button"
        >
          <span className={styles.refIdStyle}>{transformation.refId}</span>
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
            //invalid={validationError !== null}
            onChange={onInputChange}
            className={styles.refIdInput}
            data-testid="transformation-refid-input"
          />
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
      marginLeft: theme.spacing(0.5),
      overflow: 'hidden',
    }),
    refIdWrapper: css({
      display: 'flex',
      cursor: 'pointer',
      border: '1px solid transparent',
      borderRadius: theme.shape.radius.default,
      alignItems: 'center',
      padding: theme.spacing(0, 0, 0, 0.5),
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
      marginLeft: theme.spacing(0.5),
    }),
    refIdEditIcon: cx(
      css({
        marginLeft: theme.spacing(2),
        visibility: 'hidden',
      }),
      'query-name-edit-icon'
    ),
    refIdInput: css({
      maxWidth: '300px',
      margin: '-4px 0',
    }),
    collapsedText: css({
      fontWeight: theme.typography.fontWeightRegular,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      paddingLeft: theme.spacing(1),
      alignItems: 'center',
      overflow: 'hidden',
      fontStyle: 'italic',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
    }),
    contextInfo: css({
      fontSize: theme.typography.bodySmall.fontSize,
      fontStyle: 'italic',
      color: theme.colors.text.secondary,
      paddingLeft: '10px',
      paddingRight: '10px',
    }),
    itemWrapper: css({
      display: 'flex',
      marginLeft: '4px',
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
