import React, { FC, FormEvent, useState } from 'react';
import { isDateTime } from '@grafana/data';
import { Input } from '../../Input/Input';
import { Field } from '../../Forms/Field';

interface Props {
  value: string;
  label: string;
  onChange: (value: string) => void;
}

const errorMessage = 'Please enter a past date or "now"';

export const RelativeTimeRangeInput: FC<Props> = ({ label, onChange, value }) => {
  const [invalid, setInvalid] = useState<boolean>(false);

  const validateAndChange = (event: FormEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value;
    if (!isDateTime(value)) {
      setInvalid(true);
    }
    onChange(value);
  };

  return (
    <Field label={label} invalid={invalid} error={errorMessage}>
      <Input
        onClick={(event) => event.stopPropagation()}
        onChange={validateAndChange}
        aria-label="TimePicker from field"
        value={value}
      />
    </Field>
  );
};
