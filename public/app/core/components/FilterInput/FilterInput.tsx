import React, { forwardRef } from 'react';
import { escapeStringForRegex, unEscapeStringFromRegex } from '@grafana/data';
import { Forms, Icon } from '@grafana/ui';

export interface Props {
  value: string | undefined;
  placeholder?: string;
  labelClassName?: string;
  inputClassName?: string;
  onChange: (value: string) => void;
  useNewForms?: boolean;
}

export const FilterInput = forwardRef<HTMLInputElement, Props>((props, ref) =>
  props.useNewForms ? (
    <Forms.Input
      // Replaces the usage of ref
      autoFocus
      prefix={<Icon name="search" />}
      type="text"
      size="md"
      value={props.value ? unEscapeStringFromRegex(props.value) : ''}
      onChange={event => props.onChange(escapeStringForRegex(event.currentTarget.value))}
      placeholder={props.placeholder ?? ''}
    />
  ) : (
    <label className={props.labelClassName}>
      <input
        ref={ref}
        type="text"
        className={props.inputClassName}
        value={props.value ? unEscapeStringFromRegex(props.value) : ''}
        onChange={event => props.onChange(escapeStringForRegex(event.target.value))}
        placeholder={props.placeholder ?? ''}
      />
      <i className="gf-form-input-icon fa fa-search" />
    </label>
  )
);
