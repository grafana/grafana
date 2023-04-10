import React from 'react';

import { LegacyForms } from '@grafana/ui';
const { FormField } = LegacyForms;

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export const MaxLinesField = (props: Props) => {
  const { value, onChange } = props;
  return (
    <>
      <h3 className="page-heading">Queries</h3>

      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form">
            <FormField
              label="Maximum lines"
              labelWidth={11}
              inputWidth={20}
              inputEl={
                <input
                  type="number"
                  className="gf-form-input width-8 gf-form-input--has-help-icon"
                  value={value}
                  onChange={(event) => onChange(event.currentTarget.value)}
                  spellCheck={false}
                  placeholder="1000"
                />
              }
              tooltip={
                <>
                  Loki queries must contain a limit of the maximum number of lines returned (default: 1000). Increase
                  this limit to have a bigger result set for ad-hoc analysis. Decrease this limit if your browser
                  becomes sluggish when displaying the log results.
                </>
              }
            />
          </div>
        </div>
      </div>
    </>
  );
};
