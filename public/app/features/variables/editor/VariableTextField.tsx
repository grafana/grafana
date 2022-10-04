import React, { FormEvent, PropsWithChildren, ReactElement } from 'react';

import { Field, Input } from '@grafana/ui';

interface VariableTextFieldProps {
  value: string;
  name: string;
  placeholder?: string;
  onChange: (event: FormEvent<HTMLInputElement>) => void;
  testId?: string;
  required?: boolean;
  width?: number;
  grow?: boolean;
  onBlur?: (event: FormEvent<HTMLInputElement>) => void;
  maxLength?: number;
  description?: React.ReactNode;
  invalid?: boolean;
  error?: React.ReactNode;
}

export function VariableTextField({
  value,
  name,
  placeholder = '',
  onChange,
  testId,
  width,
  required,
  onBlur,
  grow,
  description,
  invalid,
  error,
  maxLength,
}: PropsWithChildren<VariableTextFieldProps>): ReactElement {
  return (
    <Field label={name} description={description} invalid={invalid} error={error}>
      <Input
        type="text"
        id={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        width={grow ? undefined : width ?? 25}
        data-testid={testId}
        maxLength={maxLength}
        required={required}
      />
    </Field>
  );
}
