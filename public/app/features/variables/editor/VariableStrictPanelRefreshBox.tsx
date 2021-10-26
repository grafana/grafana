import React, { ReactElement } from 'react';
import { Alert, Checkbox, Field } from '@grafana/ui';

export interface VariableStrictPanelRefreshBoxProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export function VariableStrictPanelRefreshBox({ value, onChange }: VariableStrictPanelRefreshBoxProps): ReactElement {
  return (
    <>
      <Alert title="Strict panel refresh" severity="info">
        <p>
          Using strict panel refresh means only panels that are affected by a variable change will be refreshed. The
          default setting is to refresh all panels when a variable changes.
        </p>
        <p>
          <i>
            If strict panel refresh setting is used then the data in panels not affected by a variable change might look
            stale until next refresh.
          </i>
        </p>
      </Alert>
      <Field label="Strict panel refresh">
        <Checkbox
          id="variables-settings-strict-mode"
          value={value}
          onChange={(e) => onChange(e.currentTarget.checked)}
        />
      </Field>
    </>
  );
}
