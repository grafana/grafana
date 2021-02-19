import React, { forwardRef } from 'react';
import { escapeStringForRegex, unEscapeStringFromRegex } from '@grafana/data';

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
      value={unEscapeStringFromRegex(props.value)}
      onChange={event => props.onChange(escapeStringForRegex(event.target.value))}
      placeholder={props.placeholder ? props.placeholder : null}
    />
    <i className="gf-form-input-icon fa fa-search" />
  </label>
));
