import React from 'react';

import { config } from '@grafana/runtime';
import { Badge, LegacyForms } from '@grafana/ui';

const { FormField } = LegacyForms;

type Props = {
  maxLines: string;
  onMaxLinedChange: (value: string) => void;
  predefinedOperations: string;
  onPredefinedOperationsChange: (value: string) => void;
};

export const QuerySettings = (props: Props) => {
  const { maxLines, onMaxLinedChange, predefinedOperations, onPredefinedOperationsChange } = props;
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
                  value={maxLines}
                  onChange={(event) => onMaxLinedChange(event.currentTarget.value)}
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
        {config.featureToggles.lokiPredefinedOperations && (
          <div className="gf-form-inline">
            <div className="gf-form">
              <FormField
                label="Predefined operations"
                labelWidth={11}
                inputEl={
                  <input
                    type="string"
                    className="gf-form-input width-20 gf-form-input--has-help-icon"
                    value={predefinedOperations}
                    onChange={(event) => onPredefinedOperationsChange(event.currentTarget.value)}
                    spellCheck={false}
                    placeholder="| unpack | line_format"
                  />
                }
                tooltip={
                  <div>
                    {
                      'Predefined operations are used as an initial state for your queries. They are useful, if you want to unpack, parse or format all log lines. Currently we support only log operations starting with |. For example: | unpack | line_format "{{.message}}".'
                    }
                  </div>
                }
              />
              <Badge
                text="Experimental"
                color="orange"
                icon="exclamation-triangle"
                tooltip="Predefined operations is an experimental feature that may change in the future."
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
};
