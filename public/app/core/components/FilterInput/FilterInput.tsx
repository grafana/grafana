import React, { FC } from 'react';
import { escapeStringForRegex, unEscapeStringFromRegex } from '@grafana/data';
import { Input, Icon } from '@grafana/ui';

export interface Props {
  value: string | undefined;
  placeholder?: string;
  labelClassName?: string;
  inputClassName?: string;
  onChange: (value: string) => void;
}

export const FilterInput: FC<Props> = props => (
  <Input
    // Replaces the usage of ref
    autoFocus
    prefix={<Icon name="search" />}
    width={40}
    type="text"
    value={props.value ? unEscapeStringFromRegex(props.value) : ''}
    onChange={event => props.onChange(escapeStringForRegex(event.currentTarget.value))}
    placeholder={props.placeholder ?? ''}
  />
);
