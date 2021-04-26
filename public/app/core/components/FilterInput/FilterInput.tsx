import React, { FC } from 'react';
import { escapeStringForRegex, unEscapeStringFromRegex } from '@grafana/data';
import { Input, Icon, Button } from '@grafana/ui';

export interface Props {
  value: string | undefined;
  placeholder?: string;
  width?: number;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}

export const FilterInput: FC<Props> = ({ value, placeholder, width, onChange, autoFocus }) => {
  const suffix =
    value !== '' ? (
      <Button icon="times" buttonStyle="text" size="sm" onClick={() => onChange('')}>
        Clear
      </Button>
    ) : null;

  return (
    <Input
      autoFocus={autoFocus ?? false}
      prefix={<Icon name="search" />}
      suffix={suffix}
      width={width ?? 40}
      type="text"
      value={value ? unEscapeStringFromRegex(value) : ''}
      onChange={(event) => onChange(escapeStringForRegex(event.currentTarget.value))}
      placeholder={placeholder}
    />
  );
};
