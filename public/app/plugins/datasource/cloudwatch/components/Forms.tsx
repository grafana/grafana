import React, { InputHTMLAttributes, FunctionComponent } from 'react';

import { InlineFormLabel } from '@grafana/ui';

export interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  tooltip?: string;
  children?: React.ReactNode;
}

export const QueryField: FunctionComponent<Partial<Props>> = ({ label, tooltip, children }) => (
  <>
    <InlineFormLabel width={8} className="query-keyword" tooltip={tooltip}>
      {label}
    </InlineFormLabel>
    {children}
  </>
);

export const QueryInlineField: FunctionComponent<Props> = ({ ...props }) => {
  return (
    <div className={'gf-form-inline'}>
      <QueryField {...props} />
      <div className="gf-form gf-form--grow">
        <div className="gf-form-label gf-form-label--grow" />
      </div>
    </div>
  );
};
