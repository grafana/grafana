import { css } from '@emotion/css';
import { useId } from '@react-aria/utils';
import { FormEvent, PropsWithChildren, ReactElement } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Field, TextArea, useStyles2 } from '@grafana/ui';

interface VariableTextAreaFieldProps {
  name: string;
  value?: string;
  defaultValue?: string;
  placeholder: string;
  onChange?: (event: FormEvent<HTMLTextAreaElement>) => void;
  width: number;
  ariaLabel?: string;
  required?: boolean;
  testId?: string;
  onBlur?: (event: FormEvent<HTMLTextAreaElement>) => void;
  description?: React.ReactNode;
}

export function VariableTextAreaField({
  value,
  defaultValue,
  name,
  description,
  placeholder,
  onChange,
  onBlur,
  ariaLabel,
  required,
  width,
  testId,
}: PropsWithChildren<VariableTextAreaFieldProps>): ReactElement {
  const styles = useStyles2(getStyles);
  const id = useId();

  return (
    <Field label={name} description={description} htmlFor={id}>
      <TextArea
        id={id}
        rows={2}
        value={value}
        defaultValue={defaultValue}
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

export function getStyles(theme: GrafanaTheme2) {
  return {
    textarea: css({
      whiteSpace: 'pre-wrap',
      minHeight: theme.spacing(4),
      height: 'auto',
      overflow: 'auto',
      padding: `${theme.spacing(0.75)} ${theme.spacing(1)}`,
      width: 'inherit',

      [theme.breakpoints.down('sm')]: {
        width: '100%',
      },
    }),
  };
}
