import React, { forwardRef } from 'react';
import { escapeStringForRegex, unEscapeStringFromRegex } from '@grafana/data';
import { Icon } from '@grafana/ui';

export interface Props {
  value: string | undefined;
  placeholder?: string;
  labelClassName?: string;
  inputClassName?: string;
  onChange: (value: string) => void;
}

export const FilterInput = forwardRef<HTMLInputElement, Props>((props, ref) => (
  <label className={props.labelClassName}>
    <input
      ref={ref}
      type="text"
      className={props.inputClassName}
      value={props.value ? unEscapeStringFromRegex(props.value) : ''}
      onChange={event => props.onChange(escapeStringForRegex(event.target.value))}
      placeholder={props.placeholder ?? ''}
    />
    <Icon name="search" className="gf-form-input-icon" />
  </label>
));
