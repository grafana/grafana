import React, { useEffect, useState } from 'react';

import { Input } from '@grafana/ui';

type Props = {
  value: number;
  placeholder?: string;
  onChange: (number: number) => void;
  width?: number;
  fieldDisabled?: boolean;
};

// this is an input-field that only
// calls `props.onChange` when it's value
// is a number. to allow the user
// to edit the value, we need to maintain
// the current displayValue in a local state.
export function NumberInput(props: Props) {
  const [displayValue, setDisplayValue] = useState('');

  const { value } = props;

  useEffect(() => {
    setDisplayValue(value.toString());
  }, [value]);

  const onChange = (e: React.FocusEvent<HTMLInputElement>) => {
    const text = e.currentTarget.value;
    setDisplayValue(text);

    // we need to make sure the value is really a number
    if (text.trim() === '') {
      // calling `Number('')` returns zero,
      // so we have to handle this case
      return;
    }

    const num = Number(text);

    if (Number.isNaN(num)) {
      return;
    }

    props.onChange(num);
  };

  return (
    <Input
      type="number"
      value={displayValue}
      onChange={onChange}
      placeholder={props.placeholder}
      disabled={props.fieldDisabled}
      width={props.width}
    />
  );
}
