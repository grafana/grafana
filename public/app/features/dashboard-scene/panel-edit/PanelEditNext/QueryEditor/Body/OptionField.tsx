import { css } from '@emotion/css';
import { FocusEvent, ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Input, Tooltip, useStyles2 } from '@grafana/ui';

import { CONTENT_SIDE_BAR, QUERY_OPTION_FIELD_CONFIG } from '../../constants';
import { QueryOptionField } from '../types';

export interface OptionFieldProps {
  field: QueryOptionField;
  onBlur?: (event: FocusEvent<HTMLInputElement>, field: QueryOptionField) => void;
  focusedField?: QueryOptionField | null;
  defaultValue?: string | number;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  children?: ReactNode;
}

export function OptionField({
  field,
  onBlur,
  focusedField,
  defaultValue = '',
  placeholder,
  hint,
  disabled,
  children,
}: OptionFieldProps) {
  const styles = useStyles2(getStyles);
  const config = QUERY_OPTION_FIELD_CONFIG[field];
  const tooltip = config.getTooltip();
  const label = config.getLabel();

  return (
    <div className={styles.field}>
      <Tooltip content={tooltip}>
        <Icon name="info-circle" size="md" className={styles.infoIcon} />
      </Tooltip>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.fieldContent}>
        {children ?? (
          <Input
            type={config.inputType ?? 'text'}
            value={disabled ? defaultValue : undefined}
            defaultValue={disabled ? undefined : defaultValue}
            placeholder={placeholder ?? config.placeholder}
            onBlur={onBlur ? (e) => onBlur(e, field) : undefined}
            autoFocus={!disabled && focusedField === field}
            disabled={disabled}
            aria-label={label}
            className={styles.fieldInput}
          />
        )}
        {hint && <span className={styles.hint}>{`= ${hint}`}</span>}
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    field: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(0.5, 0),
    }),
    fieldLabel: css({
      width: CONTENT_SIDE_BAR.fieldLabelWidth,
      flexShrink: 0,
      color: theme.colors.text.primary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontFamily: theme.typography.fontFamilyMonospace,
      whiteSpace: 'nowrap',
    }),
    fieldContent: css({
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      minWidth: 0,
    }),
    fieldInput: css({
      width: CONTENT_SIDE_BAR.labelWidth,
      flexShrink: 0,
    }),
    infoIcon: css({
      color: theme.colors.text.secondary,
      flexShrink: 0,
    }),
    hint: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontFamily: theme.typography.fontFamilyMonospace,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      minWidth: 0,
    }),
  };
}
