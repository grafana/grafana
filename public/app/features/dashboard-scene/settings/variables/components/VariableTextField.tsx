import { useId } from '@react-aria/utils';
import { FormEvent, PropsWithChildren } from 'react';
import * as React from 'react';

import { Field, Input } from '@grafana/ui';

interface VariableTextFieldProps {
  value?: string;
  defaultValue?: string;
  name?: string;
  placeholder?: string;
  onChange?: (event: FormEvent<HTMLInputElement>) => void;
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
  defaultValue,
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
}: PropsWithChildren<VariableTextFieldProps>) {
  const id = useId(name);

  return (
    <Field label={name} description={description} invalid={invalid} error={error} htmlFor={id}>
      <Input
        type="text"
        id={id}
        placeholder={placeholder}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        onBlur={onBlur}
        width={grow ? undefined : (width ?? 30)}
        data-testid={testId}
        maxLength={maxLength}
        required={required}
      />
    </Field>
  );
}
