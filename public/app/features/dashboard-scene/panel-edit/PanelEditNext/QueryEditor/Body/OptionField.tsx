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
  children?: ReactNode;
}

export function OptionField({
  field,
  onBlur,
  focusedField,
  defaultValue = '',
  placeholder,
  children,
}: OptionFieldProps) {
  const styles = useStyles2(getStyles);
  const config = QUERY_OPTION_FIELD_CONFIG[field];
  const tooltip = config.getTooltip();
  const label = config.getLabel();
  const inputType = config.inputType ?? 'text';
  const resolvedPlaceholder = placeholder ?? config.placeholder;

  return (
    <div className={styles.field}>
      <Tooltip content={tooltip}>
        <Icon name="info-circle" size="md" className={styles.infoIcon} />
      </Tooltip>
      <span className={styles.fieldLabel}>{label}</span>
      {children ?? (
        <Input
          type={inputType}
          defaultValue={defaultValue}
          placeholder={resolvedPlaceholder}
          onBlur={onBlur ? (e) => onBlur(e, field) : undefined}
          autoFocus={focusedField != null && focusedField === field}
          aria-label={label}
          className={styles.fieldInput}
        />
      )}
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
      flex: 1,
      color: theme.colors.text.primary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontFamily: theme.typography.fontFamilyMonospace,
      whiteSpace: 'nowrap',
    }),
    fieldInput: css({
      width: CONTENT_SIDE_BAR.labelWidth,
      flexShrink: 0,
    }),
    infoIcon: css({
      color: theme.colors.text.secondary,
      flexShrink: 0,
    }),
  };
}
