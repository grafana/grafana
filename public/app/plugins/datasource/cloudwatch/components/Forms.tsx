import React, { InputHTMLAttributes, FunctionComponent } from 'react';
import { Input, FormLabel } from '@grafana/ui';

export interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  inputEl?: React.ReactNode;
  tooltip?: string;
}

export const FormField: FunctionComponent<Partial<Props>> = ({ label, inputEl, className, tooltip, ...inputProps }) => (
  <>
    <FormLabel width={8} className="query-keyword" tooltip={tooltip}>
      {label}
    </FormLabel>

    {inputEl || <Input type="text" className={`gf-form-input`} {...inputProps} />}
  </>
);

export const InlineFormField: FunctionComponent<Props> = ({ ...props }) => {
  return (
    <div className={'gf-form-inline'}>
      <FormField {...props} />
      <div className="gf-form gf-form--grow">
        <div className="gf-form-label gf-form-label--grow" />
      </div>
    </div>
  );
};
