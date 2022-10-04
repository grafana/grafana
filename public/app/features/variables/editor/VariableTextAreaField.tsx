import { css } from '@emotion/css';
import React, { FormEvent, PropsWithChildren, ReactElement, useCallback } from 'react';

import { GrafanaTheme } from '@grafana/data';
import { Field, TextArea, useStyles } from '@grafana/ui';

interface VariableTextAreaFieldProps {
  name: string;
  value: string;
  placeholder: string;
  onChange: (event: FormEvent<HTMLTextAreaElement>) => void;
  width: number;
  ariaLabel?: string;
  required?: boolean;
  testId?: string;
  onBlur?: (event: FormEvent<HTMLTextAreaElement>) => void;
}

export function VariableTextAreaField({
  value,
  name,
  placeholder,
  onChange,
  onBlur,
  ariaLabel,
  required,
  width,
  testId,
}: PropsWithChildren<VariableTextAreaFieldProps>): ReactElement {
  const styles = useStyles(getStyles);
  const getLineCount = useCallback((value: any) => {
    if (value && typeof value === 'string') {
      return value.split('\n').length;
    }

    return 1;
  }, []);

  return (
    <Field label={name}>
      <TextArea
        rows={getLineCount(value)}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        required={required}
        aria-label={ariaLabel}
        cols={width}
        className={styles.textarea}
        data-testid={testId}
      />
    </Field>
  );
}

function getStyles(theme: GrafanaTheme) {
  return {
    textarea: css`
      white-space: pre-wrap;
      min-height: 32px;
      height: auto;
      overflow: auto;
      padding: 6px 8px;
    `,
  };
}
