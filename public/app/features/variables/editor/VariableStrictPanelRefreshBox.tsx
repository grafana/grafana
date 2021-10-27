import React, { ReactElement } from 'react';
import { Field, RadioButtonGroup } from '@grafana/ui';

export interface VariableStrictPanelRefreshBoxProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export function VariableStrictPanelRefreshBox({ value, onChange }: VariableStrictPanelRefreshBoxProps): ReactElement {
  return (
    <>
      <Field
        label="Panel refresh"
        description="Panel refresh determines which panels will be refreshed when any variable changes"
      >
        <RadioButtonGroup
          value={value}
          options={[
            { label: 'All panels', value: false },
            { label: 'Panels impacted by variable change', value: true },
          ]}
          onChange={onChange}
        />
      </Field>
    </>
  );
}
